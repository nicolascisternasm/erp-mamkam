require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') })

const PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN
const PAGE_ID = '872356506116562'

console.log('PAGE_ID:', PAGE_ID)
console.log('TOKEN definido:', !!PAGE_ACCESS_TOKEN)

async function run() {
  // 1. Ver suscripciones actuales
  console.log('\n--- Suscripciones actuales ---')
  const getCurrentRes = await fetch(
    `https://graph.facebook.com/v19.0/${PAGE_ID}/subscribed_apps?access_token=${PAGE_ACCESS_TOKEN}`
  )
  const current = await getCurrentRes.json()
  console.log(JSON.stringify(current, null, 2))

  // 2. Suscribirse al evento leadgen
  console.log('\n--- Suscribiendo a leadgen ---')
  const subscribeRes = await fetch(
    `https://graph.facebook.com/v19.0/${PAGE_ID}/subscribed_apps`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscribed_fields: 'leadgen',
        access_token: PAGE_ACCESS_TOKEN
      })
    }
  )
  const result = await subscribeRes.json()
  console.log(JSON.stringify(result, null, 2))
}

run().catch(console.error)
