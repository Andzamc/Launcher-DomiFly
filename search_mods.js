async function search() {
    const url = 'https://api.modrinth.com/v2/search?query=menu&limit=20'
    const res = await fetch(url)
    const data = await res.json()
    data.hits.forEach(h => {
        if (h.loaders && h.loaders.includes('fabric')) {
            console.log(h.title, '| slug:', h.slug, '| desc:', h.description)
        }
    })
}
search()
