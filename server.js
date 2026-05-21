const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*" },
    transports: ["websocket", "polling"]
});

// IMPORTANT: must be /public
app.use(express.static("public"));

let waitingUser = null;

io.on("connection", (socket) => {

    console.log("Connected:", socket.id);

    // MATCH USERS
    socket.on("findMatch", () => {

        if (waitingUser && waitingUser.id !== socket.id) {

            // SAFE VERSION (NO TEMPLATE STRINGS BUG EVER)
            const roomId = "room-" + waitingUser.id + "-" + socket.id;

            socket.join(roomId);
            waitingUser.join(roomId);

            waitingUser.emit("matched", {
                roomId,
                isCaller: true
            });

            socket.emit("matched", {
                roomId,
                isCaller: false
            });

            waitingUser = null;

        } else {
            waitingUser = socket;
            socket.emit("waiting");
        }
    });

    // WEBRTC SIGNALING
    socket.on("offer", (data) => {
        socket.to(data.roomId).emit("offer", data.offer);
    });

    socket.on("answer", (data) => {
        socket.to(data.roomId).emit("answer", data.answer);
    });

    socket.on("ice-candidate", (data) => {
        socket.to(data.roomId).emit("ice-candidate", data.candidate);
    });

    // MUTE SYNC
    socket.on("mute-state", (data) => {
        socket.to(data.roomId).emit("partner-mute-state", {
            isMuted: data.isMuted
        });
    });

    // NEXT USER
    socket.on("next", () => {

        socket.rooms.forEach(room => {
            if (room !== socket.id) {
                socket.leave(room);
                socket.to(room).emit("partner-disconnected");
            }
        });

        if (waitingUser && waitingUser.id === socket.id) {
            waitingUser = null;
        }

        socket.emit("waiting");
    });

    // CLEANUP
    socket.on("disconnect", () => {
        if (waitingUser && waitingUser.id === socket.id) {
            waitingUser = null;
        }
    });

});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log("Velora running on port", PORT);
});
