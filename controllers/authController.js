const db = require("../models");

module.exports = {
    verifyUser: (req, res) => {
        console.log(req.params);
        db.User
            .findOne({
                where: {
                    username: req.params.username
                }
            })
            .then(data => res.json(data))
            .catch(err => res.status(422).json(err));
    },
    addUser: (req, res) => {
        db.User
            .create({
                username: req.body.username,
                password: req.body.password
            })
            .then(data => res.send(true))
            .catch(err => res.status(422).json(err));
    }
}