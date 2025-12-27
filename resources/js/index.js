const RSS2JSON_BASE = "https://api.rss2json.com/v1/api.json?rss_url=";
const ACCORDION_ID = "newsAccordion";
const MAX_ARTICLES = 20; 


function escapeHtml(s) {
    if (!s) return "";
    return s
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

function escapeAttr(s) {
    if (!s) return "";
    return s.replaceAll("'", "\\'").replaceAll('"', "&quot;");
}

function stripHtml(html) {
    if (!html) return "";
    const doc = new DOMParser().parseFromString(html, 'text/html');
    let text = doc.body.textContent || "";
    
    const maxLength = 150; 
    if (text.length > maxLength) {
        text = text.substring(0, maxLength).trim() + '...';
    }
    return text.trim();
}

function extractImageFromContent(content) {
    if (!content) return null;
    const m = content.match(/<img[^>]+src=["']([^"']+)["']/i);
    return m ? m[1] : null;
}

const FALLBACK_IMAGE =
    "data:image/svg+xml;charset=UTF-8," +
    encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450">' +
        '<rect width="100%" height="100%" fill="#ddd"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#666" font-size="24">No image</text></svg>'
    );


/**
 * Fetches RSS feed data, processes it, and renders the carousel inside the accordion.
 * @param {Object} t - Topic object {id, title, url}
 */
async function loadTopic(t) {
    const carouselRoot = document.getElementById(`carousel-${t.id}`);
    if (!carouselRoot) return;

    try {
        let rssUrl = t.url;
        if (!rssUrl) throw new Error("No feed URL provided.");
        
        if (!rssUrl.endsWith(".rss") && !rssUrl.includes(".rss?")) {
            if (rssUrl.includes("flipboard.com")) {
                rssUrl = rssUrl.replace(/\/$/, "") + ".rss";
            }
        }
        
        const fullUrl = RSS2JSON_BASE + encodeURIComponent(rssUrl);

        const res = await fetch(fullUrl);
        if (!res.ok) throw new Error("Failed to fetch feed: " + res.status);
        const data = await res.json();
        
        const items = Array.isArray(data.items)
            ? data.items.slice(0, MAX_ARTICLES)
            : [];

        if (items.length === 0) {
            carouselRoot.innerHTML = `<div class="alert alert-info">No articles found for "${escapeHtml(t.title)}".</div>`;
            return;
        }

        const carouselId = `carouselInner-${t.id}`;
        
        const innerItemsHtml = items
            .map((it, idx) => {
                let image =
                    it.thumbnail ||
                    it.enclosure?.link ||
                    extractImageFromContent(it.content) ||
                    FALLBACK_IMAGE;
                
                const description = stripHtml(it.description || it.contentSnippet || "");
                const title = it.title || "Untitled";
                const link = it.link || "#";

                return `
                    <div class="carousel-item ${idx === 0 ? "active" : ""}">
                        <div class="card news-card shadow-sm" role="button" onclick="window.open('${escapeAttr(link)}', '_blank')">
                            <img src="${escapeAttr(image)}" class="card-img-top" alt="${escapeAttr(title)}" onerror="this.src='${FALLBACK_IMAGE}'"/>
                            <div class="card-body">
                                <h5 class="card-title">${escapeHtml(title)}</h5>
                                <p class="card-text">${escapeHtml(description)}</p>
                            </div>
                        </div>
                    </div>
                `;
            })
            .join("");

        const controlsHtml = `
            <div id="${carouselId}" class="carousel slide" data-bs-interval="false" data-bs-wrap="true">
                <div class="carousel-inner">
                    ${innerItemsHtml}
                </div>
                <button class="carousel-control-prev" type="button" data-bs-target="#${carouselId}" data-bs-slide="prev" aria-label="Previous">
                    <span class="carousel-control-prev-icon" aria-hidden="true"></span>
                </button>
                <button class="carousel-control-next" type="button" data-bs-target="#${carouselId}" data-bs-slide="next" aria-label="Next">
                    <span class="carousel-control-next-icon" aria-hidden="true"></span>
                </button>
            </div>
        `;

        carouselRoot.innerHTML = controlsHtml;

        Array.from(carouselRoot.querySelectorAll(".news-card")).forEach((el) => {
            el.setAttribute("tabindex", "0");
            el.addEventListener("keypress", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    el.click();
                }
            });
        });

    } catch (err) {
        console.error("Error loading topic", t, err);
        carouselRoot.innerHTML = `<div class="alert alert-danger">Could not load "${escapeHtml(t.title)}". ${escapeHtml(err.message || "")}</div>`;
    }
}

document.addEventListener('DOMContentLoaded', () => {

    if (!window.magazines || !Array.isArray(window.magazines) || window.magazines.length < 3) {
        document.getElementById(ACCORDION_ID).innerHTML = `
            <div class="alert alert-warning">Error: <code>magazines</code> array is not available or has fewer than 3 items.</div>
        `;
        return;
    }

    const topics = window.magazines.slice(0, 3).map((m, idx) => {
        return {
            id: "topic" + idx,
            title: m.title || m.topic || `Topic ${idx + 1}`,
            url: m.url || m.feed || m.rss || m, 
        };
    });

    const accordion = document.getElementById(ACCORDION_ID);

    accordion.innerHTML = topics
        .map((t, i) => {
            const expanded = i === 0; 
            const headerId = `heading-${t.id}`;
            const collapseId = `collapse-${t.id}`;
            const carouselId = `carousel-${t.id}`;

            return `
                <div class="accordion-item mb-3">
                    <h2 class="accordion-header" id="${headerId}">
                        <button class="accordion-button ${expanded ? "" : "collapsed"}" type="button"
                            data-bs-toggle="collapse" data-bs-target="#${collapseId}"
                            aria-expanded="${expanded}" aria-controls="${collapseId}">
                            ${escapeHtml(t.title)}
                        </button>
                    </h2>
                    <div id="${collapseId}" class="accordion-collapse collapse ${expanded ? "show" : ""}" 
                        aria-labelledby="${headerId}" data-bs-parent="#${ACCORDION_ID}">
                        <div class="accordion-body p-0">
                            <div id="${carouselId}">
                                <div class="text-center p-5">
                                    <div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div>
                                    <p class="mt-2 text-muted">Loading ${escapeHtml(t.title)}...</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        })
        .join("");
    
    topics.forEach((t, idx) => {
        const collapseEl = document.getElementById(`collapse-${t.id}`);
        if (!collapseEl) return;
        
        if (idx === 0) {
            loadTopic(t);
        } else {
            collapseEl.addEventListener("shown.bs.collapse", () => {
                const root = document.getElementById(`carousel-${t.id}`);
                if (root && root.querySelector(".spinner-border")) {
                    loadTopic(t);
                }
            }, { once: true });
        }
    });
});








// fcode


// function newAccordian(title, id) {
//   let accordian = `
//   <div class="accordion-item" id="item${id}">
//       <h2 class="accordion-header" id="heading${id}">
//           <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse${id}" aria-expanded="true" aria-controls="collapse${id}">
//               ${title}
//           </button>
//       </h2>
//       <div id="collapse${id}" class="accordion-collapse collapse" aria-labelledby="heading${id}" data-bs-parent="#data">
//       </div>
//   </div>`;
//   return accordian;
// }

// function newCarousel(id, innerId) {
//   let carousel = `
//   <div id="carousel${id}" class="carousel slide" data-bs-ride="carousel">
//       <div id="${innerId}" class="carousel-inner">
//       </div>
//       <button class="carousel-control-prev" type="button" data-bs-target="#carousel${id}" data-bs-slide="prev">
//           <span class="carousel-control-prev-icon" aria-hidden="true"></span>
//           <span class="visually-hidden">Previous</span>
//       </button>
//       <button class="carousel-control-next" type="button" data-bs-target="#carousel${id}" data-bs-slide="next">
//           <span class="carousel-control-next-icon" aria-hidden="true"></span>
//           <span class="visually-hidden">Next</span>
//       </button>
//   </div>`
//   return carousel;
// }

// function newCarouselInner(id, firstItem) {
//   let carouselInner;
//   if (firstItem) {
//       carouselInner = `<div id=${id} class="carousel-item active"></div>`;
//   }
//   else {
//       carouselInner = `<div id=${id} class="carousel-item"></div>`;
//   }
//   return carouselInner;
// }

// function newCard(item) {
//   let card = `
//   <div class="card">
//       <img src="${item.enclosure.link}" class="card-img-top carousel-image" alt="image">
//       <div class="card-body">
//           <h5 class="card-title">${item.title}</h5>
//           <h6 class="card-subtitle mb-2 text-muted">${item.author}</h6>
//           <p class="card-subtitle text-secondary">${item.pubDate}</p>
//           <p class="card-text">${item.description}</p>
//           <a href="${item.link}" class="stretched-link" target="_blank"></a>
//       </div>
//   </div>`;
//   return card;
// }

// let getId = () => Math.random().toString(36).substr(2, 9);

// async function populateData() {
//   for (let x = 0; x < magazines.length; x++) {
//       let url = magazines[x];
//       //Getting API response for the corresponding url
//       let apiResponse = await fetch("https://api.rss2json.com/v1/api.json?rss_url=" + encodeURI(url))
//       //Fetching data from the response
//       let fetchedData = await apiResponse.json()

//       let accordianInnerId = getId();
//       let accordian = newAccordian(fetchedData.feed.title, accordianInnerId);
//       document.getElementById("data").innerHTML += accordian;
//       if (x == 0) {
//           document.getElementById("collapse" + accordianInnerId).classList.add("show");
//       }

//       let carouselId = getId();
//       let carouselInnerId = getId();
//       let carousel = newCarousel(carouselId, carouselInnerId);
//       document.getElementById("collapse" + accordianInnerId).innerHTML += carousel;

//       let cardItems = fetchedData.items
//       for (let y in cardItems) {
//           let cardId = getId();
//           let carouselInner = newCarouselInner(cardId, y == 0);
//           document.getElementById(carouselInnerId).innerHTML += carouselInner;

//           let card=newCard(cardItems[y]);
//           document.getElementById(cardId).innerHTML+=card;
//       }
      
//   }
// }

// populateData();