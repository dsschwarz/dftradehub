const dbo = require('./db/conn');
const auth = require('./auth/auth');
const utils = require("./utils");

const BASE_AFFINITY = 0.1;

async function checkAffinityRecompute(userId) {
    const dbConnect = dbo.getDb();
    const userResult = await dbConnect
        .collection("users")
        .findOne(
            { _id: userId },
            { projection: { affinityCountdown: 1 } }
        )

    console.log("Checking if user needs affinity recompute", userResult);
    if (userResult.affinityCountdown <= 0) {
        await dbConnect
            .collection("users")
            .updateOne(
                { _id: userId, affinityCountdown: userResult.affinityCountdown },
                { $set: { affinityCountdown: 30 } }
            )
        return true;
    } else {
        console.log("Skipping affinity recompute", userId);
        await dbConnect
            .collection("users")
            .updateOne(
                { _id: userId, affinityCountdown: userResult.affinityCountdown },
                { $inc: { affinityCountdown: -1 } }
            )
        return false;
    }
}

async function computeAffinities(userId) {
    const dbConnect = dbo.getDb();

    console.log("Recomputing affinities for user", userId)
    await utils.trace("compute.affinities", async () => {
        await dbConnect
            .collection("nameRatings")
            .aggregate([
                {
                    '$match': {
                        userId
                    }
                }, {
                    '$set': {
                        'ratingWeight': {
                            '$switch': {
                                'branches': [
                                    {
                                        'case': {
                                            '$eq': [
                                                '$rating', 'LOVED'
                                            ]
                                        },
                                        'then': 5
                                    }, {
                                        'case': {
                                            '$eq': [
                                                '$rating', 'LIKED'
                                            ]
                                        },
                                        'then': 1
                                    }, {
                                        'case': {
                                            '$eq': [
                                                '$rating', 'DISLIKED'
                                            ]
                                        },
                                        'then': -1
                                    }
                                ]
                            }
                        }
                    }
                }, {
                    '$lookup': {
                        'from': 'nameLibrary',
                        'localField': 'name',
                        'foreignField': 'name',
                        'as': 'nameLibrary'
                    }
                }, {
                    '$project': {
                        'datasets': {
                            '$objectToArray': {
                                '$first': '$nameLibrary.datasets'
                            }
                        },
                        'ratingWeight': 1,
                        'userId': 1
                    }
                }, {
                    '$unwind': '$datasets'
                }, {
                    '$set': {
                        'datasetName': '$datasets.k',
                        'weightedAffinity': {
                            '$multiply': [
                                '$ratingWeight', '$datasets.v'
                            ]
                        }
                    }
                }, {
                    '$group': {
                        '_id': '$datasetName',
                        'summedAffinity': {
                            '$sum': '$weightedAffinity'
                        },
                        'userId': {
                            '$first': '$userId'
                        }
                    }
                }, {
                    '$project': {
                        "userId": 1,
                        'datasetName': "$_id",
                        'affinity': {
                            '$add': [BASE_AFFINITY, "$summedAffinity"]
                        },
                        _id: false
                    }
                }, {
                    '$merge': {
                        'into': "affinities",
                        'on': ["userId", "datasetName"],
                        'whenMatched': "replace"
                    }
                }
            ]).toArray();
    });
    console.log("Finished computing affinities");
    await updateNameRankings(userId);
}

async function updateNameRankings(userId) {
    const dbConnect = dbo.getDb();
    await utils.trace("updateNameRankings", async () => {
        await dbConnect
            .collection("nameLibrary")
            // in future iterations, could rank names based on the combination of what you and your partner like, instead of just your own preferences
            // idea: some kind of "Suggestion algorithm" option with choices of "Based on what I like", "Based on what my partner or I like", "Based on what we both like", "Surprise me"
            // And add option for tag filters. Tags can be regular, important, or NOT.
            // * Important tags are required.
            // * Regular tags add an OR clause (will behave like an Important tag if there's only one Regular tag)
            // * Not tags filter out any name with that tag
            .aggregate([
                {
                    $project: {
                        name: 1,
                        dataset: { $objectToArray: "$datasets" }
                    }
                }, {
                    $unwind: "$dataset"
                }, {
                    $lookup: {
                        from: 'affinities',
                        localField: "dataset.k",
                        foreignField: "datasetName",
                        pipeline: [
                            {
                                $match: {
                                    userId
                                }
                            }
                        ],
                        as: 'affinity'
                    }
                }, {
                    $group: {
                        _id: "$name",
                        rank: {
                            $sum: { $multiply: [{ $ifNull: [{ $first: "$affinity.affinity" }, BASE_AFFINITY] }, "$dataset.v"] }
                        }
                    }
                }, {
                    $project: {
                        _id: 0,
                        name: "$_id",
                        userId,
                        rank: 1
                    }
                }, {
                    $merge: {
                        into: "nameRankings",
                        on: ["name", "userId"],
                        whenMatched: "replace"
                    }
                }
            ], { allowDiskUse: true })
            .toArray();
    });
}

async function checkForMatches(userId, name) {
    const dbConnect = dbo.getDb();
    const result = await dbConnect
        .collection("partners")
        .aggregate([
            {
                $match: { "users.userId": userId }
            },
            {
                $lookup: {
                    from: 'nameRatings',
                    let: { "users": "$users.userId" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$name", name] },
                                        { $in: ["$userId", "$$users"] },
                                        { $in: ["$rating", ["LIKED", "LOVED"]] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: 'likes'
                },
            },
            {
                $match: {
                    $expr: {
                        $eq: [{ $size: "$likes" }, { $size: "$users" }]
                    }
                }
            },
            {
                $project: {
                    _id: 1
                }
            }
        ]).toArray();

    console.log(`Found ${result.length} lists with a new match on name: <${name}>`, result)

    return result;
}

async function addToPartnerLists(userId, name) {
    const dbConnect = dbo.getDb();
    const partners = await dbConnect
        .collection("partners")
        .aggregate([
            {
                $match: {
                    "users.userId": userId
                }
            },
            {
                $set: {
                    partnerIds: {
                        $filter: { input: "$users", as: "user", cond: { $ne: ["$$user", userId] } }
                    }
                }
            },
            {
                $unwind: "$partnerIds"
            },
            {
                $lookup: {
                    from: "nameRatings",
                    localField: "partnerIds.userId",
                    foreignField: "userId",
                    pipeline: [
                        { $match: { $expr: { $eq: ["$name", name] } } }
                    ],
                    as: "likes"
                }
            },
            {
                $match: {
                    $expr: {
                        $eq: [{ $size: "$likes" }, 0]
                    }
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "partnerIds.userId",
                    foreignField: "_id",
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $in: [name, { $ifNull: ["$nameQueue", []] }]
                                }
                            }
                        }
                    ],
                    as: "nameQueue"
                }
            },
            {
                $match: {
                    $expr: {
                        $eq: [{ $size: "$nameQueue" }, 0]
                    }
                }
            },
            {
                $project: {
                    partnerIds: 1
                }
            }
        ])
        .toArray()

    const partnerIds = partners.map(n => n.partnerIds.userId);
    console.log(`Adding name <${name}> to partner queues`, partnerIds);
    const addNamesResult = await dbConnect
        .collection("users")
        .updateMany({ _id: { $in: partnerIds } },
            { $addToSet: { nameQueue: name } }
        )
    console.log("Finished adding names to partners", addNamesResult)
}

module.exports = {
    getResolvers: (request) => ({
        reset: async () => {
            const dbConnect = dbo.getDb();
            const userId = auth.requireLogin(request).userId;

            console.log("Removing all matches")
            await dbConnect
                .collection("partners")
                .deleteMany({ "users.userId": userId })

            console.log("Removing all ratings")
            await dbConnect
                .collection("nameRatings")
                .deleteMany({ userId })

            console.log("Removing name queue")
            await dbConnect
                .collection("users")
                .updateOne({ _id: userId },
                    { $set: { nameQueue: [] } })
        },
        rateName: async ({ name: unsanitizedName, rating }) => {
            const name = unsanitizedName.toUpperCase();
            const dbConnect = dbo.getDb();
            const userId = auth.requireLogin(request).userId;

            const ratingResult = await dbConnect
                .collection("nameRatings")
                .findOneAndUpdate(
                    { name, userId },
                    { $set: { rating } },
                    {
                        upsert: true
                    });

            console.log("Added name rating", ratingResult);

            const removeFromQueueResult = await dbConnect
                .collection("users")
                .updateOne(
                    { _id: userId },
                    { $pull: { nameQueue: name } }
                )

            console.log("Removed from nameQueue", removeFromQueueResult);

            if (rating === "LIKED" || rating === "LOVED") {
                addToPartnerLists(userId, name); // async
            }
            if (await checkAffinityRecompute(userId)) {
                computeAffinities(userId); // async
            }

            if (rating === "DISLIKED") {
                // remove matches
                console.log("Removing matches", userId, name);
                const result = await dbConnect
                    .collection("partners")
                    .updateMany({
                        $and: [
                            {
                                "users.userId": userId
                            },
                            { matches: { $exists: true } }
                        ],
                    }, {
                        $pull: {
                            "matches": {
                                name: name
                            }
                        }
                    })

                    console.log("done", result)

                return {
                    success: true,
                    matched: false
                }
            } else {
                // check matches
                const newMatches = await checkForMatches(userId, name);
                if (newMatches.length > 0) {
                    console.log("It's a match!", name)
                    const createMatch = {
                        $addToSet: {
                            "matches": {
                                insertedAt: new Date().toISOString(),
                                name: name
                            }
                        }
                    }
                    const result = await dbConnect
                        .collection("partners")
                        .updateMany({
                            $and: [
                                { _id: { $in: newMatches.map(match => match._id) } },
                                {
                                    $or: [
                                        { matches: { $exists: false } },
                                        {
                                            matches: {
                                                $not: {
                                                    $elemMatch: { name }
                                                }
                                            }
                                        }
                                    ]
                                }
                            ],
                        }, createMatch)
                    console.log("Finished creating matches", result)

                    return {
                        success: true,
                        matched: true
                    }
                } else {
                    return {
                        success: true,
                        matched: false
                    }
                }
            }
        }
    }),
    computeAffinities
}