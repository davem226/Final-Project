const db = require("../models");

module.exports = {
    saveArticle: (req, res) => {
        db.Article
            .create({
                source: req.body.source,
                title: req.body.title,
                sentimentTitle: req.body.sentimentTitle,
                preview: req.body.preview,
                sentimentPreview: req.body.sentimentPreview,
                uid: req.body.uid,
                choice: req.body.choice
            })
            .then(dbArticle => res.json(dbArticle))
            .catch(err => res.status(422).json(err));
    },
    getArticles: (req, res) => {
        db.Article
            .findAll({ where: { uid: req.params.uid } })
            .then(dbArticle => res.json(dbArticle))
            .catch(err => res.status(422).json(err));
    }
}