const marked = require('marked');

const multer = require('multer');

const MongoClient = require('mongodb').MongoClient;
const mongoURL = process.env.MONGO_URL || 'mongodb://localhost:27017';

const path = require('path');
const express = require('express');

const app = express();
const port = process.env.PORT || 3000;

async function initMongo() {
  console.log('Initialising MongoDB...');
  let success = false;
  let client = null;
  while (!success) {
    try {
      client = await MongoClient.connect(mongoURL, { useNewUrlParser: true });
      success = true;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  console.log('MongoDB initialised');
  return client.db('dev').collection('notes');
}

async function retrieveNotes(db) {
  const notes = (await db.find().toArray()).reverse();
  return notes.map(it => {
    return { ...it, description: marked(it.description) };
  });
}

async function saveNote(db, note) {
  await db.insertOne(note);
}

async function start() {
  const db = await initMongo();

  app.set('view engine', 'pug');
  app.set('views', path.join(__dirname, 'views'));
  app.use(express.static(path.join(__dirname, 'public')));

  app.listen(port, () => {
    console.log(`App listening on http://localhost:${port}`);
  });

  app.post(
    '/note',
    multer({ dest: path.join(__dirname, 'public/uploads/') }).single('image'),
    async (req, res) => {
      if (!req.body.upload && req.body.description) {
        await saveNote(db, { description: req.body.description });
        res.redirect('/');
      } else if (req.body.upload && req.file) {
        const link = `/uploads/${encodeURIComponent(req.file.filename)}`;
        res.render('index', {
          content: `${req.body.description} ![](${link})`,
          notes: await retrieveNotes(db)
        });
      }
    }
  );

  app.get('/', async (req, res) => {
    res.render('index', { notes: await retrieveNotes(db) });
  });
}

start();
