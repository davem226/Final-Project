import React, { Component } from "react";
import { Link } from "react-router-dom";
import Container from "../../components/Containers/Subs";
import { TopicContainer, ArticleContainer, TopicList } from "../../components/Containers"
import { AppName } from "../../components/Logo";
import Message from "../../components/Message";
import { ArticleSearch, SearchBtn, IsLiked } from "../../components/Forms";
import Topic from "../../components/Topic";
import Article from "../../components/Article";
import news from "../../utils/news";
import API from "../../utils/api";
import LogReg from "../../utils/LogReg";
import "./Profile.css";

export class Profile extends Component {
    state = {
        uid: "",
        isAuthenticated: false,
        query: "",
        contents: [],
        topicShown: "",
        toBeRated: [],
        θ: []
    };
    componentDidMount() {
        // Ensure user is logged in
        const uid = document.getElementById("root").getAttribute("uid");
        this.setState({ uid: uid });
        if (!uid) return null;
        this.showSavedArticles(uid);
    };
    async showSavedArticles(uid) {
        // Array of parameters specific to user
        let θ = await this.estimateParameters(uid);
        // Array of articles JSON for each topic
        const contents = await this.getContents(uid);
        if (!contents) return null;
        // Keep only the articles the user is predicted to like
        const filteredContents = await this.filterArticles(θ, contents);
        // Render articles in DOM; Save θ for use if user add new topic during session
        this.setState({ contents: filteredContents, θ: θ });
    };
    async estimateParameters(uid) {
        const LR = new LogReg();
        let results = await API.getArticles(uid);
        const reviewedArticles = results.data;
        if (reviewedArticles.length === 0) return [];
        const analyzableData = LR.processData(reviewedArticles);
        console.log(analyzableData);
        const θ = LR.fit(analyzableData, 1000);
        // Regression won't give valid results unless number of data points >> than number of parameters
        if (analyzableData.length > θ.length + 5) return θ;
        else return [];
    };
    async getContents(uid) {
        let results = await API.getTopics(uid);
        const savedTopics = results.data;
        if (savedTopics.length === 0) return null;
        const newsAPIresults = [];
        for (let obj of savedTopics) {
            let results = await news.get(obj.topic);
            newsAPIresults.push(results);
        }
        return this.parseArticleJSON(savedTopics, newsAPIresults);
    };
    parseArticleJSON = (topics, newsResults) => {
        return topics.map((obj, i) => {
            return {
                topic: obj.topic,
                articles: newsResults[i].data.articles.map((article, j) => {
                    return {
                        id: j,
                        source: article.source.name,
                        link: article.url,
                        title: article.title,
                        preview: article.description
                    }
                })
            };
        });
    };
    async filterArticles(θ, contents) {
        const sentiments = await this.sentimentAnalysis(contents);
        // Map through each article of each topic and predict if user will like it
        return contents.map(content => {
            const filteredArticles = content.articles.map(article => {
                // "Add" sentiment scores to each article so LR.predict can run on it 
                const updatedArticle = Object.assign({}, article, {
                    ...article,
                    sentimentTitle: sentiments.find(entry => entry.id === `${content.topic}-${article.id}-title`).score,
                    sentimentPreview: sentiments.find(entry => entry.id === `${content.topic}-${article.id}-preview`).score,
                });
                // If user hasn't rated any articles, LR.predict fails
                if (θ.length === 0) return updatedArticle;
                const LR = new LogReg();
                return LR.predict(θ, updatedArticle, 0.5) ? updatedArticle : null;
                // Filter out articles user predicted to not like
            }).filter(article => article);

            // "Update" each contents object
            return Object.assign({}, content, {
                ...content,
                articles: filteredArticles
            });
        });
    };
    // Outputs array of objects with sentiment scores
    async sentimentAnalysis(contents) {
        // Concatenate all titles and previews into one array
        const documents = [];
        contents.map(content => {
            content.articles.map(article => {
                documents.push({ language: "en", id: `${content.topic}-${article.id}-title`, text: article.title });
                documents.push({ language: "en", id: `${content.topic}-${article.id}-preview`, text: article.preview });
            });
        });
        let results = await news.sentiment({ documents });
        console.log(results.data);
        return results.data.documents;
    };
    async searchArticles(topic) {
        if (!topic) return null;
        this.saveTopic({ topic: topic, uid: this.state.uid });
        let articleJSON = await news.get(topic);
        const content = this.parseArticleJSON([{ topic }], [articleJSON]);
        let filteredContent = await this.filterArticles(this.state.θ, content);

        // Update state
        this.setState(state => { return { contents: [...state.contents, ...filteredContent] } });
        document.getElementById("article-search").reset();
    };
    saveTopic = ({ topic, uid }) => {
        API.saveTopic({ topic, uid })
            .then(res => null)
            .catch(err => console.log(err));
    };
    showArticles = (topic) => {
        this.setState({ topicShown: topic });
    };
    showIsLiked = (id) => {
        this.setState(state => {
            return {
                toBeRated: state.toBeRated.concat(id)
            }
        });
    };
    saveChoice = (choice, uid, article, articleID) => {
        API.saveArticle({
            source: article.source,
            title: article.title,
            sentimentTitle: article.sentimentTitle,
            preview: article.preview,
            sentimentPreview: article.sentimentPreview,
            uid: uid,
            choice: choice
        }).catch(err => console.log(err));

        this.setState(state => {
            return {
                toBeRated: state.toBeRated.filter(i => i !== articleID)
            }
        });
    };
    handleInputChange = event => {
        const { name, value } = event.target;
        this.setState({
            [name]: value
        });
    };

    render() {
        return (
            <Container id="profile">
                <TopicContainer>
                    <AppName />
                    <Link to="/">
                        <div id="logout">Log Out</div>
                    </Link>
                    <Message id="enter" text="Enter a topic and get your personalized news!" />
                    <ArticleSearch
                        onchange={this.handleInputChange}
                    >
                        <SearchBtn onClick={() => this.searchArticles(this.state.query)} />
                    </ArticleSearch>

                    <TopicList>
                        {this.state.contents.map(x => (
                            <Topic
                                topic={x.topic}
                                onclick={() => this.showArticles(x.topic)}
                            />
                        ))}
                    </TopicList>
                </TopicContainer>
                {this.state.topicShown ? (
                    <ArticleContainer>
                        {this.state.contents.filter(x =>
                            x.topic === this.state.topicShown)[0].articles
                            .map((article, i) => (
                                < Article
                                    id={i}
                                    link={article.link}
                                    title={article.title}
                                    source={article.source}
                                    preview={article.preview}
                                    onclick={() => this.showIsLiked(i)}
                                >
                                    {this.state.toBeRated.includes(i) ? (
                                        <IsLiked
                                            onYesClick={() => this.saveChoice("yes", this.state.uid, article, i)}
                                            onNoClick={() => this.saveChoice("no", this.state.uid, article, i)}
                                        />
                                    ) : ("")}
                                </Article>
                            ))
                        }
                    </ArticleContainer>
                ) : ("")
                }
            </Container>
        );
    }
}