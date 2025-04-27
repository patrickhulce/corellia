import fs from 'fs'

async function checkAvailability(plate: string): Promise<string> {
  const encodedPlate = encodeURIComponent(plate)
  const url = `https://www.myplates.com/api/licenseplates/passenger/carbon-fiber/${encodedPlate}?_=${Date.now()}`
  const response = await fetch(url, {
    headers: {
      accept: 'application/json, text/javascript, */*; q=0.01',
      'accept-language': 'en-US,en;q=0.9',
      Referer: 'https://www.myplates.com/design/personalized/passenger/carbon-fiber/',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
    method: 'GET',
  })

  if (!response.ok) throw new Error(`Check failed: ${await response.text()}`)

  const body: any = await response.json()
  console.log('replied!', body)
  return body.status
}

function generatePermutations(plate: string): string[] {
  const replacements: Record<string, string[] | undefined> = {
    A: ['A', '4'],
    I: ['I', '1'],
    E: ['E', '3'],
    O: ['O', '0'],
    S: ['S', '5'],
    T: ['T', '7'],
  }

  const vowels = ['A', 'E', 'I', 'O', 'U']

  const result: string[] = []

  // Recursive function to generate permutations
  function generate(remaining: string, current: string) {
    if (remaining.length === 0) {
      result.push(current)
      return
    }

    const [char, ...rest] = remaining
    const chars = replacements[char.toUpperCase()] || [char]

    chars.forEach(replacement => {
      generate(rest.join(''), current + replacement)
    })

    if (vowels.includes(char.toUpperCase())) {
      generate(rest.join(''), current) // Skip the vowel
    }
  }

  generate(plate, '')
  return result.filter(p => p.replace(/\s+/g, '').length <= 7)
}

async function checkPlate(desiredPlate: string): Promise<string[]> {
  if (!desiredPlate || desiredPlate.replace(/\s+/g, '').length > 10) {
    throw new Error(`Invalid plate "${desiredPlate}"`)
  }

  const permutations = generatePermutations(desiredPlate)

  const availablePlates: string[] = []

  for (const plate of permutations) {
    try {
      console.log(`Checking ${plate} availability...`)
      const availability = await checkAvailability(plate)
      const isAvailable = availability === 'available'
      console.log(isAvailable ? 'Available! 🎉' : 'Not available ❌')
      if (isAvailable) availablePlates.push(plate)
    } catch (error) {
      console.error(`Error occurred while checking ${plate}: ${error}`)
    }

    await new Promise(r => setTimeout(r, 1000 + Math.ceil(Math.random() * 2000)))
  }

  return availablePlates
}

// Entry point
async function main() {
  const desiredPlateOrFile = process.argv[2] || '.data/plates.txt'

  if (!fs.existsSync(desiredPlateOrFile) && desiredPlateOrFile.endsWith('.txt')) {
    throw new Error(`File "${desiredPlateOrFile}" does not exist`)
  }

  if (fs.existsSync(desiredPlateOrFile)) {
    const plates = fs.readFileSync(desiredPlateOrFile, 'utf8').trim().split('\n').filter(Boolean)
    const availablePlates = await Promise.all(plates.map(checkPlate))
    console.log(`Available plates:\n${availablePlates.join('\n')}`)
  } else {
    const availablePlates = await checkPlate(desiredPlateOrFile)
    console.log(`Available plates:\n${availablePlates.join('\n')}`)
  }
}

main().catch(error => console.error(error))
