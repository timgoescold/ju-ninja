const posts = [...devlogs].sort((a, b) => b.date.localeCompare(a.date));

function addText(parent, tag, text, className = "")
{
    const element = document.createElement(tag);
    element.textContent = text;
    element.className = className;
    parent.appendChild(element);
    return element;
}

function postDate(post)
{
    return new Date(post.date + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) + (post.version ? " · " + post.version : "");
}

const latest = document.getElementById("latest-title");
if (latest)
{
    const post = posts[0];
    latest.textContent = post ? post.title : "nothing yet";
    document.getElementById("latest-date").textContent = post ? postDate(post) : "";
    const summary = post ? post.body.trim().replace(/\s+/g, " ") : "check back later.";
    document.getElementById("latest-summary").textContent = summary.length > 180 ? summary.slice(0, 180) + "…" : summary;
}

const list = document.getElementById("devlog-list");
if (list)
{
    if (!posts.length) addText(list, "p", "nothing yet.");
    for (const post of posts)
    {
        const article = document.createElement("article");
        article.className = "log-post";
        addText(article, "p", postDate(post), "log-meta");
        addText(article, "h2", post.title);
        for (const paragraph of post.body.trim().split(/\n\s*\n/)) addText(article, "p", paragraph, "log-body");
        for (const path of post.images || [])
        {
            const img = document.createElement("img");
            img.src = path;
            img.alt = "Gameplay screenshot for " + post.title;
            img.loading = "lazy";
            article.appendChild(img);
        }
        list.appendChild(article);
    }
}
