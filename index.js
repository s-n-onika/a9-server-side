const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

const roomsRoutes = require("./routes/roomsRoutes.js");

const app = express();
const port = process.env.PORT || 5000;

if (!process.env.MONGODB_URI || !process.env.JWT_SECRET) {
    throw new Error("Missing environment variables");
}

app.use(cors({
    origin: "https://a9-client-side.vercel.app",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
}));

app.options("*", cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use((req, res, next) => {

    res.setHeader(
        "Content-Security-Policy",
        `
        default-src 'self';
        connect-src 'self'
        http://localhost:5000
        http://localhost:5173
        https://studynook-server-alpha.vercel.app
        https://a9-client-side.vercel.app
        https://*.googleapis.com
        https://*.firebaseapp.com
        https://identitytoolkit.googleapis.com;
        
        img-src 'self' data: https:;
        
        script-src 'self' 'unsafe-inline' 'unsafe-eval';
        
        style-src 'self' 'unsafe-inline';
        
        frame-src
        https://accounts.google.com
        https://*.firebaseapp.com;
        `
    );

    res.setHeader(
        "Cross-Origin-Opener-Policy",
        "same-origin-allow-popups"
    );

    res.setHeader("X-Content-Type-Options", "nosniff");

    next();
});
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

const verifyToken = (req, res, next) => {
    const token = req.cookies?.token;

    if (!token) {
        return res.status(401).send({ message: "Unauthorized access" });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: "Unauthorized access" });
        }

        req.user = decoded;
        next();
    });
};

let db;
async function getDB() {
    if (!db) {
        await client.connect();
        db = client.db("StudyNookBD");
    }
    return db;
}

app.use("/api/rooms", (req, res, next) => {
    getDB()
        .then((activeDB) => {
            roomsRoutes(activeDB, verifyToken)(req, res, next);
        })
        .catch((err) => {
            res.status(500).send({ message: "Database initialization failed." });
        });
});

app.post("/api/bookings", verifyToken, async (req, res) => {
    try {
        const activeDB = await getDB();
        const bookingsCollection = activeDB.collection("bookings");
        const booking = req.body;

        const conflict = await bookingsCollection.findOne({
            roomId: booking.roomId,
            date: booking.date,
            status: "confirmed",
            $or: [
                {
                    startTime: { $lt: booking.endTime },
                    endTime: { $gt: booking.startTime },
                },
            ],
        });

        if (conflict) {
            return res.status(400).send({ message: "Time slot already booked" });
        }

        const result = await bookingsCollection.insertOne({
            ...booking,
            status: "confirmed",
            createdAt: new Date(),
        });

        await activeDB.collection("rooms").updateOne(
            { _id: new ObjectId(booking.roomId) },
            { $inc: { bookingCount: 1 } }
        );

        res.send(result);
    } catch (error) {
        res.status(500).send({ message: "Booking failed" });
    }
});

app.get("/api/bookings", verifyToken, async (req, res) => {
    try {
        const activeDB = await getDB();
        const result = await activeDB.collection("bookings")
            .find({ userEmail: req.user.email })
            .toArray();
        res.send(result);
    } catch (error) {
        res.status(500).send({ message: "Failed to fetch bookings" });
    }
});

app.patch("/api/bookings/:id/cancel", verifyToken, async (req, res) => {
    try {
        const activeDB = await getDB();
        const id = req.params.id;
        const result = await activeDB.collection("bookings").updateOne(
            { _id: new ObjectId(id), userEmail: req.user.email },
            { $set: { status: "cancelled" } }
        );
        res.send(result);
    } catch (error) {
        res.status(500).send({ message: "Cancel failed" });
    }
});

app.post("/api/jwt", async (req, res) => {
    try {
        const user = req.body;

        const token = jwt.sign(
            { email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.cookie("token", token, {
            httpOnly: true,
            secure: true,
            sameSite: "none"
        });

        res.send({ success: true });

    } catch (error) {
        console.error("JWT ERROR:", error);
        res.status(500).send({
            message: "JWT generation failed"
        });
    }
});

app.get("/api/logout", (req, res) => {
    res.clearCookie("token");
    return res.json({ message: "Logged out" });
});

app.post("/api/logout", (req, res) => {
    res.clearCookie("token", {
        httpOnly: true,
        secure: true,
        sameSite: "none"
    });

    res.json({ success: true });
});

app.get("/", (req, res) => {
    res.send("StudyNook Server Running");
});

if (process.env.NODE_ENV !== "production") {
    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
}

module.exports = app;
