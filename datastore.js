const axios = require("axios");

/**
 * @type {Set<RoomStorage>}
 */
let LOCAL_ROOMS = new Set();

class Player {
    constructor(userId) {
        this.userId = userId;
        this.letters = [];
        this.finished = false;
        this.wpm = 0;
    }

    setFinished(finished) {
        this.finished = finished;
        return this;
    }

    setWPM(wpm) {
        this.wpm = wpm;
        return this;
    }

    addLetter(letter) {
        this.letters.push(letter);
        return this;
    }

    setLetters(letters) {
        this.letters = letters;
        return this;
    }

    toJSON() {
        return {
            userId: this.userId,
            letters: this.letters,
        };
    }
}

class RoomStorage {
    constructor(roomId, startedTime = new Date().getTime()) {
        this.roomId = roomId;
        this.startedTime = startedTime;
        this.players = [];
        this.quote = "";
    }

    setStartedTime(time) {
        this.startedTime = time;
        return this;
    }

    setQuote(text) {
        this.quote = text;
        return this;
    }

    /**
     * 
     * @param {Player[]} players 
     */
    setPlayers(players) {
        this.players = players;
        return this;
    }

    /**
     * 
     * @param {Player} player 
     * @returns 
     */
    addPlayer(player) {
        this.players.push(player);
        return this;
    }

    /**
     * 
     * @param {string} userId 
     * @returns {Player | undefined}
     */
    getPlayer(userId) {
        return this.players?.find(player => player.userId === userId) || undefined;
    }

    /**
     * 
     * @param {Player} player 
     * @returns 
     */
    updatePlayer(player) {
        const index = this.players.findIndex(p => p.userId === player.userId);
        if (index !== -1) {
            this.players[index] = player;
        } else {
            this.players.push(player);
        }
        return this;
    }

    /**
     * 
     * @param {Player} player 
     * @returns 
     */
    getPlayerWPM(player) {
        const timeTaken = (new Date().getTime() - this.startedTime) / 1000 / 60; // in minutes
        const wpm = Math.round((player.letters.length / 5) / timeTaken);
        return wpm;
    }

    /**
     * 
     * @param {Player} player 
     * @returns {number}
     */
    getPlayerAccuracy(player) {
        // this will not be correct on the words exceding letters
        const quoteLetters = this.quote.split(" ").join("").split("");
        const playerLetters = player.letters;
        const correctLetters = playerLetters.filter((letter, index) => letter === quoteLetters[index]);
        const accuracy = Math.round((correctLetters.length / quoteLetters.length) * 100);
        return accuracy;
    }

    /**
     * 
     * @returns {RoomStorage}
     */
    update() {
        const index = [...LOCAL_ROOMS].findIndex(room => room.roomId === this.roomId);
        if (index !== -1) {
            LOCAL_ROOMS[index] = this;
        } else {
            LOCAL_ROOMS.add(this);
        }
        return this;
    }

    add() {
        LOCAL_ROOMS.add(this);
    }

    delete() {
        return LOCAL_ROOMS.delete(this);
    }
}

/**
 * 
 * @param {number} count 
 * @returns {Promise<{ id: string, quote: string, author: string }[]>}
 */
async function getRandomQuote(count = 1) {
    try {
        const res = await axios.get(`https://dummyjson.com/quotes/random/${count}`);
        if (res.status !== 200) {
            throw new Error("Failed to fetch quotes");
        }
        return res.data;
    }
    catch (error) {
        console.error("Error fetching quotes:", error);
        return null;
    }
}

/**
 * 
 * @param {string} roomId 
 * @returns {RoomStorage | undefined}
 * @description Returns the room with the given roomId from LOCAL_ROOMS set.
 */
function getRoom(roomId) {
    return [...LOCAL_ROOMS].find(room => room.roomId === roomId);
}

function getRooms() {
    return LOCAL_ROOMS;
}

module.exports = {
    Player,
    RoomStorage,
    getRandomQuote,
    getRoom,
    getRooms,
    LOCAL_ROOMS,
}