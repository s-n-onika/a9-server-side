const express = require("express");
const { ObjectId } = require("mongodb");

function roomsRoutes(dbInstance, verifyToken) {
    const router = express.Router();

    router.get("/", async (req, res) => {
        try {
            const roomsCollection = dbInstance.collection("rooms");
            const { search, amenities, maxPrice } = req.query;
            let query = {};

            if (search && search.trim() !== "") {
                query.name = { $regex: search, $options: "i" };
            }

            if (amenities && amenities.trim() !== "") {
                query.amenities = { $all: amenities.split(",") };
            }

            if (maxPrice && maxPrice.trim() !== "") {
                const parsedPrice = parseFloat(maxPrice);
                if (!isNaN(parsedPrice)) {
                    query.hourlyRate = { $lte: parsedPrice };
                }
            }

            const result = await roomsCollection.find(query).toArray();
            res.send(result);
        } catch (error) {
            res.status(500).send({ message: "Failed to fetch rooms catalog index matrix." });
        }
    });

    router.get("/home-rooms", async (req, res) => {
        try {
            const roomsCollection = dbInstance.collection("rooms");
            const result = await roomsCollection.find().sort({ _id: -1 }).limit(3).toArray();
            res.send(result);
        } catch (error) {
            res.status(500).send({ message: "Failed to fetch featured rooms." });
        }
    });

    router.get("/:id", async (req, res) => {
        try {
            const roomsCollection = dbInstance.collection("rooms");
            const result = await roomsCollection.findOne({ _id: new ObjectId(req.params.id) });
            res.send(result);
        } catch (error) {
            res.status(500).send({ message: "Failed to fetch room parameters." });
        }
    });

    router.put("/:id", verifyToken, async (req, res) => {
        try {
            const id = req.params.id;
            const roomsCollection = dbInstance.collection("rooms");
            const updatePayload = {
                name: req.body.name,
                description: req.body.description,
                image: req.body.image,
                floor: req.body.floor,
                capacity: parseInt(req.body.capacity),
                hourlyRate: parseFloat(req.body.hourlyRate),
                amenities: req.body.amenities || [],
                updatedAt: new Date()
            };
            const result = await roomsCollection.updateOne(
                { _id: new ObjectId(id), ownerEmail: req.user.email },
                { $set: updatePayload }
            );
            res.send(result);
        } catch (error) {
            res.status(500).send({ message: "Failed to modify room record." });
        }
    });

    router.post("/", verifyToken, async (req, res) => {
        try {
            const roomsCollection = dbInstance.collection("rooms");
            const roomPayload = {
                name: req.body.name,
                description: req.body.description,
                image: req.body.image,
                floor: req.body.floor,
                capacity: parseInt(req.body.capacity),
                hourlyRate: parseFloat(req.body.hourlyRate),
                amenities: req.body.amenities || [],
                ownerEmail: req.user.email,
                ownerName: req.body.ownerName,
                bookingCount: 0,
                createdAt: new Date(),
            };
            const result = await roomsCollection.insertOne(roomPayload);
            res.status(201).send(result);
        } catch (error) {
            res.status(500).send({ message: "Failed to store room listing asset metadata." });
        }
    });

    router.delete("/:id", verifyToken, async (req, res) => {
        try {
            const id = req.params.id;
            const roomsCollection = dbInstance.collection("rooms");
            const result = await roomsCollection.deleteOne({
                _id: new ObjectId(id),
                ownerEmail: req.user.email
            });
            res.send(result);
        } catch (error) {
            res.status(500).send({ message: "Failed to process delete request." });
        }
    });

    return router;
}

module.exports = roomsRoutes;
