const session = require("express-session");
var MongoDBStore = require('connect-mongodb-session')(session);
var passport = require('passport');
var passportSteam = require('passport-steam');
var SteamStrategy = passportSteam.Strategy;

const connectionString = process.env.ATLAS_URI;

module.exports = {
    getResolvers: (request) => ({
        authUser: async () => {
            console.log("Returning auth payload for user", request.user)
            return request.user;
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

        app.set('trust proxy', 1);
        app.use(session({
            secret: process.env.SESSION_SECRET,
            store,
            resave: true,
            saveUninitialized: false,
            cookie: { secure: "auto" }
        }));

        app.get("/logout", (req, res) => {
            req.session.destroy();
            res.redirect("/");
        });

        // Setup passport
        const port = process.env.PORT || 4000;
        // Required to get data from user for sessions
        passport.serializeUser((user, done) => {
            console.log("Serialize", user);
            done(null, {
                steamId: user.id,
                displayName: user.displayName,
                profileUrl: user._json.profileurl,
                avatars: {
                    small: user._json.avatar,
                    medium: user._json.avatarmedium,
                    large: user._json.avatarfull
                }
            });
        });
        passport.deserializeUser((user, done) => {
            console.log("Deserialize", user);
            done(null, user);
        });
        // Initiate Strategy
        passport.use(new SteamStrategy({
            returnURL: 'http://localhost:' + port + '/api/auth/steam/return',
            realm: 'http://localhost:' + port + '/',
            apiKey: process.env.STEAM_API_KEY
        }, function (identifier, profile, done) {
            process.nextTick(function () {
                return done(null, profile);
            });
        }
        ));
        app.get('/api/auth/steam', passport.authenticate('steam', { failureRedirect: '/' }), function (req, res) {
            res.redirect('/')
        });
        app.get('/api/auth/steam/return', passport.authenticate('steam', { failureRedirect: '/' }), function (req, res) {
            res.redirect('/')
        });

        app.use(passport.initialize());
        app.use(passport.session());
    }
}
