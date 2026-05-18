const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.static("public"));

let waitingUser = null;

io.on("connection", (socket) => {

    console.log("Connected:", socket.id);

    socket.on("findMatch", () => {

        if (waitingUser && waitingUser.id !== socket.id) {

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

    socket.on("offer", (data) => {
        socket.to(data.roomId).emit("offer", data.offer);
    });

    socket.on("answer", (data) => {
        socket.to(data.roomId).emit("answer", data.answer);
    });

    socket.on("ice-candidate", (data) => {
        socket.to(data.roomId).emit("ice-candidate", data.candidate);
    });
    
    socket.on("mute-state", (data) => {
    socket.to(data.roomId).emit("partner-mute-state", {
        isMuted: data.isMuted
    });
});

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
});

server.listen(process.env.PORT || 3000, () => {
    console.log("Velora running");
});
