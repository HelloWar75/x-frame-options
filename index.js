const express = require('express');
const axios = require('axios');
const mime = require('mime');
const morgan = require('morgan');
const { URL } = require('url');
const mysql = require('mysql');
const fs = require('fs');
const db = require('./database');

const mysql_config = {
    connectionLimit : 5,
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '12592075',
    database: 'url_cache'
};

const database = new db(mysql_config);

const app = express();
const port = process.env.PORT || 3000;

app.use(morgan('tiny'));

const regex = /\s+(href|src)=['"](.*?)['"]/g;

const getMimeType = url => {
    if(url.indexOf('?') !== -1) { // remove url query so we can have a clean extension
        url = url.split("?")[0];
    }
    if(mime.getType(url) === 'application/x-msdownload') return 'text/html';
    return mime.getType(url) || 'text/html'; // if there is no extension return as html
};

const replaceAllLinks = (req, url, data) => {
    const urlMime = getMimeType(url); // get mime type of the requested url
    if(urlMime === 'text/html') { // replace links only in html
        data = data.toString().replace(regex, (match, p1, p2)=>{
            let newUrl = '';
            if(p2.indexOf('http') !== -1) {
                newUrl = p2;
            } else if (p2.substr(0,2) === '//') {
                newUrl = 'http:' + p2;
            } else {
                console.log("OIII");
                const searchURL = new URL(url);
                newUrl = searchURL.protocol + '//' + searchURL.host + "/" + p2;
            }
            return ` ${p1}="${req.protocol}://${req.hostname}:${port}/?url=${newUrl}"`;
        });
    }
    return [urlMime, data];
};

const isCached = (url) => {
    database.query('SELECT * FROM urls WHERE url = ?', [url])
        .then( rows => {
            console.log(rows.length);
        });
}

app.get('/', (req, res) => {
    const { url } = req.query; // get url parameter
    if(!url) {
        res.type('text/html');
        return res.end("You need to specify <code>url</code> query parameter");
    }

    

    axios.get(url, { responseType: 'arraybuffer'  }) // set response type array buffer to access raw data
        .then(({ data }) => {
            const replacedLinks = replaceAllLinks(req, url, data);
            isCached(url);
            res.type(replacedLinks[0]);
            res.send(replacedLinks[1]);
        }).catch(error => {
        console.log(error);
    });
});

app.listen(port, () => console.log(`Listening on port ${port}!`));