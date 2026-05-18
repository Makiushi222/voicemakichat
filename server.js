const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("."));

let waitingUser = null;

io.on("connection", (socket) => {
    console.log("User:", socket.id);

    socket.on("findMatch", () => {

        if (waitingUser) {
            const roomId = "room-" + waitingUser.id + "-" + socket.id;

            socket.join(roomId);
            waitingUser.join(roomId);

            socket.emit("matched", roomId);
            waitingUser.emit("matched", roomId);

            waitingUser = null;
        } else {
            waitingUser = socket;
            socket.emit("waiting");
        }
    });

    socket.on("offer", ({ offer, roomId }) => {
        socket.to(roomId).emit("offer", offer);
    });

    socket.on("answer", ({ answer, roomId }) => {
        socket.to(roomId).emit("answer", answer);
    });

    socket.on("ice-candidate", ({ candidate, roomId }) => {
        socket.to(roomId).emit("ice-candidate", candidate);
    });
});

server.listen(3000, () => {
    console.log("Server running...");
});