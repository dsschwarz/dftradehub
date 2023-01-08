const bcrypt = require('bcrypt');
const dbo = require('../db/conn');
const session = require("express-session");
var MongoDBStore = require('connect-mongodb-session')(session);

const connectionString = process.env.ATLAS_URI;

module.exports = {
    getResolvers: (request) => ({
        login: async ({ email: rawEmail, password }) => {
            const email = rawEmail.trim()?.toLowerCase();
            if (!email) {
                throw new Error("Email is required.")
            }
            if (!password) {
                throw new Error("Password is required.")
            }

            const dbConnect = dbo.getDb();
            const user = await dbConnect
                .collection("users")
                .findOne(
                    { email },
                    {
                        projection: {
                            password: 1,
                            displayName: 1,
                            email: 1
                        }
                    });

            if (!user) {
                throw Error("Authentication failed");
            }

            if (await bcrypt.compare(password, user.password)) {
                // Authentication successful, create session
                return request.session.user = {
                    userId: user._id,
                    displayName: user.displayName,
                    email: user.email
                };
            } else {
                throw Error("Authentication failed");
            }
        },
        authUser: async () => {
            console.log("Returning auth payload for user", request.session.user)
            return request.session.user;
        }
    }),
    setupAuth: function (app) {
        var store = new MongoDBStore({
            uri: connectionString,
            collection: 'sessions'
        });

        // Catch errors
        store.on('error', function (error) {
            console.error("MongoDB session store error", error);
        });

        app.use(session({
            secret: "tempsecret",
            store,
            resave: true,
            saveUninitialized: false
        }));

        app.get("/logout", (req, res) => {
            req.session.destroy();
            res.redirect("/");
        });
    }
}
