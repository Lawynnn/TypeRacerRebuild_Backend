const socketIo = require('socket.io');
const jwt = require("jsonwebtoken");
require("dotenv").config();

const User = require("../database/models/User");
const dataStore = require("../datastore");
const Room = require('../database/models/Room');
const { generateRoomCode } = require('../server/utils');

/**
 * 
 * @param {socketIo.Socket} socket 
 * @param {socketIo.Server} io 
 */
async function onSocketConnection(socket, io) {
    socket.user = await User.findOne({ token: socket.token }, { __v: 0, token: 0 });
    if (!socket.user) {
        console.log("User not found", socket.userId);
        socket.emit("unauthorized", "User not found");
        return socket.disconnect(true);
    }
    console.log("New client connected", socket.user.username);

    const userRoom = await Room.findOne({ "users.user": socket.user._id }).populate("users.user", { __v: 0, token: 0, email: 0 });
    if (userRoom) {
        socket.join(userRoom.roomCode);
        socket.emit("room-joined", {
            code: userRoom.roomCode,
            name: userRoom.roomName,
            settings: userRoom.settings,
            users: userRoom.users.map(user => {
                return {
                    isHost: user.isHost,
                    joinedAt: user.joinedAt,
                    user: {
                        _id: user.user._id,
                        userId: user.user.userId,
                        username: user.user.username,
                        avatar: user.user.avatar,
                    }
                }
            }),
        });
    }

    socket.on("send-message", (data) => {
        if (!data.message) {
            socket.emit("message-error", "Message is required.");
            return;
        }

        if (data.message.length > 100) {
            socket.emit("message-error", "Message is too long. Max 100 characters.");
            return;
        }
        if (data.message.length < 1) {
            socket.emit("message-error", "Message is too short. Min 1 character.");
            return;
        }

        const room = Array.from(socket.rooms).filter(r => r !== socket.id)[0];
        if (!room) {
            socket.emit("message-error", "You are not in a room.");
            return;
        }

        const message = {
            sender: {
                isHost: socket.user.isHost,
                joinedAt: new Date(),
                user: {
                    _id: socket.user._id,
                    userId: socket.user.userId,
                    username: socket.user.username,
                    avatar: socket.user.avatar,
                }
            },
            message: data.message,
            timestamp: new Date(),
        }
        io.to(room).emit("room-message", message);
    })

    socket.on("create-room", async (data) => {
        if (socket.rooms.size > 1) {
            socket.emit("room-error", "You are already in a room. Leave the room first.");
            return;
        }

        if (!data.roomName) {
            socket.emit("room-error", "Room name is required.");
            return;
        }

        if (data.roomName.length > 20) {
            socket.emit("room-error", "Room name is too long. Max 20 characters.");
            return;
        }
        else if (data.roomName.length < 3) {
            socket.emit("room-error", "Room name is too short. Min 3 characters.");
            return;
        }

        if (data.roomPassword && data.roomPassword.length < 3) {
            socket.emit("room-error", "Room password is too short. Min 3 characters.");
            return;
        }
        else if (data.roomPassword && data.roomPassword.length > 30) {
            socket.emit("room-error", "Room password is too long. Max 30 characters.");
            return;
        }

        const roomCode = generateRoomCode();
        const room = new Room({
            roomName: data.roomName,
            roomPassword: data.roomPassword || null,
            roomCode,
            settings: data.settings || {},
            users: [{
                user: socket.user._id,
                isHost: true
            }]
        });
        await room.save();
        socket.join(room.roomCode);
        socket.emit("room-created", {
            code: room.roomCode,
            name: room.roomName,
            settings: room.settings,
            password: room.roomPassword,
            users: [{
                isHost: true,
                joinedAt: new Date(),
                user: {
                    _id: socket.user._id,
                    userId: socket.user.userId,
                    username: socket.user.username,
                    avatar: socket.user.avatar,
                }
            }]
        });
    })

    socket.on("join-room", async (data) => {
        if (socket.rooms.size > 1) {
            socket.emit("room-error", "You are already in a room. Leave the room first.");
            return;
        }

        if (!data.roomCode) {
            socket.emit("room-error", "Room code is required.");
            return;
        }

        const room = await Room.findOne({ roomCode: data.roomCode }).populate("users.user", { __v: 0, token: 0, email: 0 });
        if (!room) {
            socket.emit("room-error", "Room not found.");
            return;
        }

        if (room.roomPassword && room.roomPassword !== data.roomPassword) {
            socket.emit("room-error", "Invalid password.");
            return;
        }

        if (room.started) {
            socket.emit("room-error", "Room has already started. You cannot join now. Wait for the next game.");
            return;
        }

        socket.join(room.roomCode);
        const userIndex = room.users.findIndex(user => user.user.toString() === socket.user._id.toString());
        if (userIndex !== -1) {
            socket.emit("room-error", "You are already in this room.");
            return;
        }

        room.users.push({
            user: socket.user._id,
            joinedAt: new Date(),
            isHost: false
        });
        await room.save();

        const roomUsers = await Room.findOne({ roomCode: data.roomCode }).populate("users.user", { __v: 0, token: 0, email: 0 });
        if (!roomUsers) {
            socket.emit("room-error", "Room not found.");
            return;
        }

        io.to(room.roomCode).emit("user-joined", {
            user: {
                isHost: false,
                joinedAt: new Date(),
                user: {
                    _id: socket.user._id,
                    userId: socket.user.userId,
                    username: socket.user.username,
                    avatar: socket.user.avatar,
                }
            },
            users: roomUsers.users.toObject()
        });

        io.to(room.roomCode).emit("room-message", {
            sender: {
                isBroadcast: true
            },
            message: `${socket.user.username} has joined the room.`,
            timestamp: new Date(),
        });

        socket.emit("room-joined", {
            code: room.roomCode,
            name: room.roomName,
            settings: room.settings,
            password: room.roomPassword,
            users: roomUsers.users.toObject(),
        });
    })

    socket.on("start-game", async () => {
        const GAME_DURATION_DEFAULT = 500; // 2 minutes
        const room = Array.from(socket.rooms).filter(r => r !== socket.id)[0];
        if (!room) {
            socket.emit("game-error", "You are not in a room.");
            return;
        }

        const roomData = await Room.findOne({ roomCode: room }).populate("users.user", { __v: 0, token: 0, email: 0 });
        if (!roomData) {
            socket.emit("game-error", "Room not found.");
            return;
        }

        if (roomData.users.length < 2) {
            socket.emit("game-error", "Not enough players to start the game.");
            return;
        }

        const quote = await dataStore.getRandomQuote(1);
        if (!quote) {
            socket.emit("game-error", "Error fetching quote. Please try again later.");
            return;
        }

        const ROOM_LOAD_TIME = 1000 * 3; // 3 seconds
        io.to(room).emit("game-starting", {
            ROOM_LOAD_TIME,
            gameSettings: roomData.settings || {
                gameDuration: GAME_DURATION_DEFAULT,
            },
        });

        setTimeout(async () => {
            roomData.started = true;
            await roomData.save();
            const roomStorage = new dataStore.RoomStorage(roomData.roomCode);
            roomStorage.setQuote(quote[0].quote).setStartedTime(Date.now()).add();
            console.log(`Game started: ${roomStorage.quote}`);

            io.to(room).emit("game-started", {
                quote: roomStorage.quote,
                endTimestamp: Date.now() + ((roomData?.settings?.gameDuration * 1000) || (GAME_DURATION_DEFAULT * 1000)),
                users: roomData.users.map(user => {
                    return {
                        isHost: user.isHost,
                        joinedAt: user.joinedAt,
                        user: {
                            _id: user.user._id,
                            userId: user.user.userId,
                            username: user.user.username,
                            avatar: user.user.avatar,
                        }
                    }
                })
            });

            setTimeout(async () => {
                roomData.started = false;
                await roomData.save();
                if (!roomStorage.delete()) {
                    console.log("Error deleting room storage", roomData.roomCode);
                }

                io.to(room).emit("game-ended", {
                    reason: "Game ended",
                    users: roomData.users.map(user => {
                        return {
                            isHost: user.isHost,
                            joinedAt: user.joinedAt,
                            user: {
                                _id: user.user._id,
                                userId: user.user.userId,
                                username: user.user.username,
                                avatar: user.user.avatar,
                            }
                        }
                    })
                });
            }, (roomData?.settings?.gameDuration * 1000) || (GAME_DURATION_DEFAULT * 1000))
        }, ROOM_LOAD_TIME);
    })

    socket.on("game-typing", (data) => {
        // data format
        // {string} letter
        // {string[]} words
        // {number} idx
        const room = Array.from(socket.rooms).filter(r => r !== socket.id)[0];
        if (!room) {
            socket.emit("typing-error", "You are not in a room.");
            return;
        }

        const storage = dataStore.getRoom(room);
        if (!storage) {
            socket.emit("typing-error", "Room not found.");
            return;
        }

        let player = storage.getPlayer(socket.user.userId);
        if (!player) {
            player = new dataStore.Player(socket.user.userId);
        }

        player.addLetter(data.letter);
        storage.updatePlayer(player);
        storage.update();

        const wpm = storage.getPlayerWPM(player);
        const words = data.words || [];
        const quoteWords = storage.quote.split(" ");
        const lastWord = quoteWords[quoteWords.length - 1];
        if(data.idx === quoteWords.length - 1 && lastWord.length <= words[data.idx].length) {
            player.setFinished(true).setWPM(wpm);
            storage.updatePlayer(player);
            storage.update();
            

            io.to(room).emit("player-finished", {
                userId: socket.user.userId,
                player: player.toJSON(),
                time: (Date.now() - storage.startedTime) / 1000,
                wpm,
                accuracy: storage.getPlayerAccuracy(player),
            })
        }
        
        io.to(room).emit("game-typed", {
            userId: socket.user.userId,
            letter: data.letter,
            player: player.toJSON(),
            wpm
        });
    })

    socket.on("disconnecting", async () => {
        try {
            const room = Array.from(socket.rooms).filter(r => r !== socket.id)[0];
            if (!room) return;

            const roomData = await Room.findOne({ roomCode: room }).populate("users.user", { __v: 0, token: 0, email: 0 });
            if (!roomData) return;
            if (roomData.users.length === 1) {
                await Room.deleteOne({ roomCode: room });
                io.to(room).emit("room-deleted", room);
                return;
            }
            const userIndex = roomData.users.findIndex(user => user.user._id.toString() === socket.user._id.toString());
            if (userIndex !== -1) {
                console.log("User disconnected", socket.user.username);
                const disconnectedUser = roomData.users[userIndex];
                if (roomData.users[userIndex].isHost) {
                    const newHostIndex = (userIndex + 1) % roomData.users.length;
                    roomData.users[newHostIndex].isHost = true;
                    io.to(room).emit("host-changed", {
                        newHost: roomData.users[newHostIndex].user,
                        oldHost: disconnectedUser,
                        reason: "disconnected"
                    });

                    io.to(room).emit("room-message", {
                        sender: {
                            isBroadcast: true
                        },
                        message: `${disconnectedUser.user.username} has left the room. ${roomData.users[newHostIndex].user.username} is now the host.`,
                        timestamp: new Date(),
                    });
                }
                roomData.users.splice(userIndex, 1);
                await roomData.save();

                if (roomData.users.length === 1 && roomData.started) {
                    roomData.started = false;
                    await roomData.save();
                    io.to(room).emit("game-ended", {
                        reason: "Too few players",
                        users: roomData.users.map(user => {
                            return {
                                isHost: user.isHost,
                                joinedAt: user.joinedAt,
                                user: {
                                    _id: user.user._id,
                                    userId: user.user.userId,
                                    username: user.user.username,
                                    avatar: user.user.avatar,
                                }
                            }
                        })
                    });
                }

                io.to(room).emit("user-disconnected", {
                    disconnectedUser,
                    users: roomData.users.map(user => {
                        return {
                            isHost: user.isHost,
                            joinedAt: user.joinedAt,
                            user: {
                                _id: user.user._id,
                                userId: user.user.userId,
                                username: user.user.username,
                                avatar: user.user.avatar,
                            }
                        }
                    }),
                });
                io.to(room).emit("room-message", {
                    sender: {
                        isBroadcast: true
                    },
                    message: `${disconnectedUser.user.username} has left the room.`,
                    timestamp: new Date(),
                });
            }
        }
        catch (err) {
            console.log("Error while disconnecting", err.message);
        }
    });

    socket.on("disconnect", () => {
        console.log("Client disconnected", socket.userId);
    })
}

module.exports = (server) => {
    const io = socketIo(server, {
        cors: {
            origin: process.env.FRONTEND_URL,
            credentials: true
        },
    });

    io.use((socket, next) => {
        const cookieHeader = socket.handshake.headers.cookie;
        if (!cookieHeader) {
            return next(new Error("No cookies sent"));
        }

        const parsed = require("cookie").parse(cookieHeader);
        const token = parsed.token;
        if (!token) {
            return next(new Error("No token found in cookies"));
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.userId = decoded.userId;
            socket.token = token;
            next();
        }
        catch (err) {
            return next(new Error("Invalid token"));
        }
    })

    io.on("connection", async (socket) => {
        onSocketConnection(socket, io);
    });
}
