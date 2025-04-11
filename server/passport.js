const passport = require("passport");
const googleStrategy = require("passport-google-oauth20").Strategy;
const githubStrategy = require("passport-github2").Strategy;

const User = require("../database/models/User");
const { generateToken } = require("./utils");
require("dotenv").config();

passport.use(new googleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_REDIRECT_URI
}, async (accessToken, refreshToken, profile, done) => {
    const userId = profile._json.sub;
    const userDupe = await User.findOne({
        $or: [
            { userId },
            { email: profile._json.email }
        ]
    }).catch(e => null);
    if (userDupe) {
        userDupe.token = generateToken(userDupe.userId);
        await userDupe.save();
        return done(null, userDupe);
    }

    const token = generateToken(userId);
    const newUser = new User({
        userId,
        username: profile._json.name,
        email: profile._json.email,
        avatar: profile._json.picture,
        token,
        provider: "GOOGLE"
    });

    try {
        await newUser.save();
    }
    catch (e) {
        return done(e, null);
    }
    return done(null, {
        userId,
        username: profile._json.name,
        email: profile._json.email,
        avatar: profile._json.picture,
        token,
        provider: "GOOGLE"
    });
}));

passport.use(new githubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: process.env.GITHUB_REDIRECT_URI
}, async (accessToken, refreshToken, profile, done) => {
    const userId = profile._json.id.toString();

    const userDupe = await User.findOne({
        $or: [
            { userId },
            { email: profile._json.email }
        ]
    }).catch(e => null);
    if (userDupe) {
        userDupe.token = generateToken(userDupe.userId);
        await userDupe.save();

        return done(null, userDupe);
    }

    const token = generateToken(userId);
    const newUser = new User({
        userId,
        username: profile._json.name,
        email: profile._json.email,
        avatar: profile._json.avatar_url,
        token,
        provider: "GITHUB"
    });

    try {
        await newUser.save();
    }
    catch (e) {
        return done(e, null);
    }

    return done(null, {
        userId,
        username: profile._json.name,
        email: profile._json.email,
        avatar: profile._json.avatar_url,
        token,
        provider: "GITHUB"
    });
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

module.exports = passport;