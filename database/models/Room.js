const mongoose = require("mongoose");
const { generateRoomCode } = require("../../server/utils");

const roomSchema = new mongoose.Schema({
    roomCode: {
        type: String,
        required: true,
        unique: true
    },
    roomName: {
        type: String,
        required: true,
    },
    roomPassword: {
        type: String,
    },
    users: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        joinedAt: {
            type: Date,
            default: Date.now,
        },
        isHost: {
            type: Boolean,
            default: false,
        }
    }],
    settings: {
        type: Object,
        default: {},
    },
    started: {
        type: Boolean,
        default: false,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    }
})

roomSchema.pre("validate", async (next) => {
    if (!this.roomCode) {
        let exists = true;
        let code = "";
        while (exists) {
            code = generateRoomCode();
            const room = await mongoose.models.Rooms.findOne({ roomCode: code });
            exists = !!room;
        }
        this.roomCode = code;
    }
    next();
})

const Room = mongoose.models.Rooms || mongoose.model("Rooms", roomSchema);
module.exports = Room;