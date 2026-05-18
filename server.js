const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

app.use(express.static("."));

let waitingUser = null;

io.on("connection", (socket) => {

    console.log("Connected:", socket.id);

    socket.on("findMatch", () => {

        if (waitingUser && waitingUser.id !== socket.id) {

            const roomId =
                "room-" + waitingUser.id + "-" + socket.id;

            socket.join(roomId);
            waitingUser.join(roomId);

            // FIRST USER = caller
            waitingUser.emit("matched", {
                roomId,
                isCaller: true
            });

            // SECOND USER
            socket.emit("matched", {
                roomId,
                isCaller: false
            });

            waitingUser = null;

        } else {

            waitingUser = socket;
        }
    });

    socket.on("offer", (data) => {

        socket.to(data.roomId)
            .emit("offer", data.offer);
    });

    socket.on("answer", (data) => {

        socket.to(data.roomId)
            .emit("answer", data.answer);
    });

    socket.on("ice-candidate", (data) => {

        socket.to(data.roomId)
            .emit("ice-candidate", data.candidate);
    });
});

server.listen(process.env.PORT || 3000, () => {

    console.log("Server running");
});
