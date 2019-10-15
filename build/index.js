const { readdir, writeFile, mkdir, readFile, copyFile, stat } = require('fs').promises
const bytes = require('bytes')
const source = process.argv[2]

main()

async function main () {
  const files = await readdir(source)
  const { velocities, release, harmonics, pedals } = sortFiles(files)

  console.log('velocities', Object.keys(velocities).length)
  console.log('samples', velocities[Object.keys(velocities)[0]].length)
  console.log('rels', release.length)
  console.log('harms', harmonics.length)
  console.log('pedals', pedals.length)

  const arrays = { release, harmonics, pedals, ...velocities }
  const sizes = Object.entries(arrays).map(async ([key, files]) => Promise.resolve(await writePackage(key, files)))

  const readme = (await readFile('README.md', 'utf8')).split('\n').slice(0, 14).join('\n') + '\n' + (await Promise.all(sizes)).map(({ name, size }) => `- \`${name}\` (${bytes(size)})`).join('\n')
  await writeFile('README.md', readme)
}

async function writePackage (key, files) {
  const package = JSON.parse(await readFile('./package.json', 'utf8'))
  const dir = `packages/${key}`

  try {
    await mkdir(dir)
  } catch (e) {}

  try {
    await mkdir(`${dir}/audio`)
  } catch (e) {}

  delete package.devDependencies
  delete package.scripts

  const pkg = {
    ...package,
    name: `@audio-samples/piano-${key}`,
    publishConfig: {
      access: 'public'
    }
  }

  delete pkg.private

  await writeFile(`${dir}/package.json`, JSON.stringify(pkg, null, 2))

  files.forEach(file => copyFile(`${source}/${file}`, `${dir}/audio/${file}`))

  const index = `module.exports = ${JSON.stringify(files, null, 2)}`

  await writeFile(`${dir}/index.js`, index)

  const size = await files.reduce(async (acc, file) => Promise.resolve((await acc) + (await stat(`${dir}/audio/${file}`)).size), Promise.resolve(0))

  const readme = `# ${pkg.name}

${pkg.description}

## Usage

\`npm install ${pkg.name}\` or CDN [https://unpkg.com/${pkg.name}@${pkg.version}/audio/](https://unpkg.com/${pkg.name}@${pkg.version}/audio/)

## Samples source

[archive.org/details/SalamanderGrandPianoV3](https://archive.org/details/SalamanderGrandPianoV3)

## Samples license

- CC BY 3.0 [creativecommons.org/licenses/by/3.0/](http://creativecommons.org/licenses/by/3.0/)
- Author: Alexander Holm 

## Total size

${bytes(size)}

## Files

${files.map(f => `- ${f}`).join('\n')}`

  await writeFile(`${dir}/README.md`, readme)

  return { size, name: pkg.name }
}

function sortFiles (files) {
  const velocities = {}
  const release = []
  const pedals = []
  const harmonics = []

  for (const file of files) {
    if (/v\d+\./.test(file)) {
      const v = file.matchAll(/v(\d+)\./)

      for (const d of v) {
        const n = `velocity${parseInt(d[1])}`
        velocities[n] = velocities[n] || []
        velocities[n].push(file)
      }
    } else if (file.startsWith('rel')) {
      release.push(file)
    } else if (file.startsWith('pedal')) {
      pedals.push(file)
    } else if (file.startsWith('harm')) {
      harmonics.push(file)
    } else {
      throw `Unknown file ${file}`
    }
  }

  return { velocities, release, harmonics, pedals }
}
