const dbo = require('./db/conn');
const auth = require('./auth/auth');
const fs = require('fs');
const utils = require("./utils");

const getConfig = (datasetName) => {
    const config = datasetConfigs[datasetName];

    if (!config) {
        console.error("Dataset config not found", datasetName);
        throw new Error("Dataset not found");
    }
    return config;
}

function sortNames(names) {
    names.sort((a,b) => b.weight - a.weight);
}

async function parseColumn(datasetName, lines, index, config) {
    let runningTotal = 0;
    const names = [];
    console.log("Parsing csv column", index, datasetName);
    lines.slice(1).forEach(line => {
        let weight;
        if (config.weight == 'standard') {
            weight = parseInt(line[index]);
        } else {
            weight = 1;
        }
        
        if (weight) {
            const name = line[0];
            names.push({
                name,
                weight
            });
            runningTotal += weight;
        }
    });
    sortNames(names);

    var dbConnect = dbo.getDb();
    await dbConnect
        .collection("datasets")
        .updateOne(
            { datasetName },
            {
                $set: {
                    datasetName,
                    names,
                    totalWeight: runningTotal
                }
            },
            { upsert: true }
        );
    console.log("Finished creating dataset");
}

async function updateNamesFromDataset(datasetName, tags) {
    console.log("Updating nameLibrary", datasetName);
    var dbConnect = dbo.getDb();
    const result = await dbConnect
        .collection("datasets")
        .aggregate([
            {
                $match: { datasetName }
            },
            {
                $unwind: {
                    path: "$names"
                }
            },
            {
                $project: {
                    datasets: {
                        [datasetName]: { $divide: ["$names.weight", "$totalWeight"] }
                    },
                    name: "$names.name",
                    tags: tags,
                    _id: 0
                }
            },
            {
                $merge: {
                    into: 'nameLibrary',
                    on: 'name',
                    whenMatched: [
                        {
                            $set: {
                                datasets: {
                                    $mergeObjects: [
                                        '$datasets',
                                        "$$new.datasets"
                                    ]
                                },
                                tags: {
                                    $setUnion: [
                                        {$ifNull: ['$tags', []]},
                                        {$ifNull: ["$$new.tags", []]}
                                    ]
                                }
                            }
                        }
                    ]
                }
            }
        ]).toArray();
    console.log("Finsihed updated nameLibrary", result);
}

module.exports = {
    getResolvers: (request) => ({
        ingestDataset: async ({ datasetName: datasetConfigName }) => {
            const config = getConfig(datasetConfigName);

            fs.readFile("./server/datasets/" + config.fileName, 'utf8', async (err, csvData) => {
                if (err) {
                    console.error(err)
                    process.exit();
                }
                const lines = csvData.split('\n').map(line => line.split(','));

                if (config.mode == "per-column") {
                    const header = lines[0];
                    const columns = header.length - 1;
                    for (var i = 1; i < columns; i++) {
                        const datasetFullName = datasetConfigName + header[i];
                        await parseColumn(datasetFullName, lines, i, config);
                        await updateNamesFromDataset(datasetFullName, config.tags);
                    }
                } else if (config.mode == "grouped") {
                    const header = lines[0];
                    const datasets = {};
                    lines.slice(1).forEach(line => {
                        // const state = line[0].replace(/"/g, '').toUpperCase();
                        const name = line[0].replace(/"/g, '').toUpperCase();
                        const gender = line[1].replace(/"/g, '').toUpperCase();
                        const weight = parseInt(line[2]);
                        const year = line[3].replace(/"/g, '').toUpperCase();
                        const decade = year.slice(0, 3) + "0s"

                        var tags;
                        if (gender == "F") {
                            tags = [GENDER_GIRL]
                        } else if (gender == "M") {
                            tags = [GENDER_BOY]
                        }

                        const datasetName = `USA-${gender}-${decade}`;
                        const datasetInfo = datasets[datasetName] || (datasets[datasetName] = {
                            datasetName,
                            totalWeight: 0,
                            names: [],
                            nameMap: {},
                            tags: tags
                        });

                        if (!datasetInfo.nameMap[name]) {
                            datasetInfo.nameMap[name] = 0;
                        }
                        datasetInfo.nameMap[name] += weight;
                        datasetInfo.totalWeight += weight;
                    });

                    console.log("Read all names");

                    for (const dataset of Object.values(datasets)) {
                        for (const name in dataset.nameMap) {
                            const weight = dataset.nameMap[name];
                            if (weight >= 200) {
                                dataset.names.push({
                                    name,
                                    weight
                                })
                            }
                        }
                        console.log("Bucketed all names", dataset.datasetName);
                        sortNames(dataset.names);
                        
                        console.log("Upserting dataset", dataset.datasetName);
                        var dbConnect = dbo.getDb();
                        await dbConnect
                            .collection("datasets")
                            .updateOne(
                                { datasetName: dataset.datasetName },
                                {
                                    $set: {
                                        datasetName: dataset.datasetName,
                                        names: dataset.names,
                                        totalWeight: dataset.totalWeight
                                    }
                                },
                                { upsert: true }
                            );

                        await utils.trace(`update.names.${dataset.datasetName}`, async () => {
                            await updateNamesFromDataset(dataset.datasetName, dataset.tags);
                        });
                    }

                } else {
                    throw new Error("config.mode not recognized", config.mode);
                }
            })
        }
    })
}