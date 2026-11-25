// Ju-Ninja community features
// This version stores data in this browser only.
// A backend is needed to share answers and vote totals between visitors.

const questions = [
    {
        question: "what's the dumbest way you've ever died in a game?",
        subtext: "i'm sure there's a good story."
    },
    {
        question: "what's a game mechanic you wish every game had?",
        subtext: "steal ideas. i don't mind."
    },
    {
        question: "if ju-ninja had a completely pointless feature, what should it be?",
        subtext: "the more unnecessary, the better."
    },
    {
        question: "what's your favourite movement ability in any game?",
        subtext: "grappling hooks are a pretty good answer."
    },
    {
        question: "what's the weirdest thing you've seen in a game?",
        subtext: "bugs count. especially bugs."
    },
    {
        question: "would you rather wall-run forever or have a ridiculous double jump?",
        subtext: "choose wisely. or don't."
    },
    {
        question: "what should a ninja absolutely not be able to do?",
        subtext: "wrong answers encouraged."
    },
    {
        question: "what's one small thing that makes a game feel amazing?",
        subtext: "tiny details matter."
    },
    {
        question: "name a sound effect that would make you laugh every time.",
        subtext: "this could become useful."
    },
    {
        question: "what's the most you've ever struggled with a really easy level?",
        subtext: "we've all been there."
    }
];

const questionText = document.getElementById("question-text");
const questionSubtext = document.getElementById("question-subtext");
const answerInput = document.getElementById("answer-input");
const answerForm = document.getElementById("answer-form");
const answerMessage = document.getElementById("answer-message");

let questionOrder = [];
let questionIndex = 0;


function shuffleQuestions()
{
    questionOrder = questions.map((_, index) => index);

    for (let i = questionOrder.length - 1; i > 0; i--)
    {
        const j = Math.floor(Math.random() * (i + 1));
        [questionOrder[i], questionOrder[j]] = [questionOrder[j], questionOrder[i]];
    }

    questionIndex = 0;
}

function showQuestion()
{
    const question = questions[questionOrder[questionIndex]];

    questionText.textContent = question.question;
    questionSubtext.textContent = question.subtext;
    answerInput.value = "";
    answerMessage.textContent = "";

}

function nextQuestion()
{
    questionIndex++;

    if (questionIndex >= questionOrder.length)
    {
        shuffleQuestions();
    }

    showQuestion();
}

// Browser storage helpers

function readStorage(key, fallback)
{
    try
    {
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) : fallback;
    }
    catch
    {
        return fallback;
    }
}

function writeStorage(key, value)
{
    try
    {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    }
    catch
    {
        return false;
    }
}

// Answers

const ANSWERS_KEY = "juNinjaCommunityAnswersV1";

function renderAnswers()
{
    const answers = readStorage(ANSWERS_KEY, []);
    const feed = document.getElementById("community-answers");
    const publicAnswers = answers.filter(answer => answer.visibility === "public");

    document.getElementById("answer-total").textContent =
        `${publicAnswers.length} ${publicAnswers.length === 1 ? "answer" : "answers"}`;

    feed.replaceChildren();

    if (publicAnswers.length === 0)
    {
        const empty = document.createElement("p");
        empty.className = "empty-answers";
        empty.textContent = "nothing here yet. you could be first.";
        feed.appendChild(empty);
        return;
    }

    publicAnswers.slice().reverse().slice(0, 8).forEach(answer =>
    {
        const item = document.createElement("article");
        item.className = "answer-item";

        const message = document.createElement("p");
        message.textContent = answer.text;

        const date = document.createElement("span");
        date.textContent = "a community answer";

        item.append(message, date);
        feed.appendChild(item);
    });
}

answerForm.addEventListener("submit", event =>
{
    event.preventDefault();

    const text = answerInput.value.trim();

    if (!text)
    {
        answerMessage.textContent = "write something first.";
        return;
    }

    const visibility = document.querySelector('input[name="sharing"]:checked').value;
    const answers = readStorage(ANSWERS_KEY, []);

    answers.push({
        text,
        visibility,
        createdAt: new Date().toISOString()
    });

    if (!writeStorage(ANSWERS_KEY, answers))
    {
        answerMessage.textContent = "couldn't save that in this browser.";
        return;
    }

    answerInput.value = "";
    answerMessage.textContent = visibility === "public"
        ? "sent. your answer is now in the feed on this browser."
        : "saved privately on this browser. it hasn't been sent to the developer yet.";

    renderAnswers();
});

// Poll

const POLL_ID = "movement-mechanic-01";
const VOTES_KEY = "juNinjaCommunityVotesV1";
const pollChoices = [
    { id: "wallrun", label: "wall running" },
    { id: "grapple", label: "grappling hook" },
    { id: "slide", label: "sliding / diving" },
    { id: "air", label: "better air control" }
];

// These are illustrative starting numbers, not real community votes.
const sampleResults = {
    wallrun: 12,
    grapple: 18,
    slide: 9,
    air: 15
};

const pollForm = document.getElementById("poll-form");
const pollMessage = document.getElementById("poll-message");
const pollResults = document.getElementById("poll-results");

function renderPollResults(vote)
{
    const totals = { ...sampleResults };

    if (vote && totals[vote] !== undefined)
    {
        totals[vote]++;
    }

    const total = Object.values(totals).reduce((sum, value) => sum + value, 0);
    const resultsList = document.getElementById("results-list");

    document.getElementById("vote-total").textContent = `${total} sample votes`;
    resultsList.replaceChildren();

    pollChoices.forEach(choice =>
    {
        const row = document.createElement("div");
        row.className = "result-row";

        const label = document.createElement("div");
        label.className = "result-label";

        const name = document.createElement("span");
        name.textContent = choice.label;

        const percentage = document.createElement("span");
        const percent = Math.round((totals[choice.id] / total) * 100);
        percentage.textContent = `${percent}%`;

        const track = document.createElement("div");
        track.className = "result-track";

        const fill = document.createElement("div");
        fill.className = "result-fill";
        fill.style.width = `${percent}%`;

        label.append(name, percentage);
        track.appendChild(fill);
        row.append(label, track);
        resultsList.appendChild(row);
    });

    pollResults.hidden = false;
}

function loadSavedVote()
{
    const votes = readStorage(VOTES_KEY, {});
    const savedVote = votes[POLL_ID];

    if (!savedVote)
    {
        return;
    }

    const selected = document.querySelector(`input[name="poll"][value="${savedVote}"]`);

    if (selected)
    {
        selected.checked = true;
    }

    document.querySelectorAll('input[name="poll"]').forEach(input =>
    {
        input.disabled = true;
    });

    document.getElementById("vote-button").disabled = true;
    document.getElementById("vote-button").textContent = "already voted";
    document.getElementById("poll-status").textContent = "VOTED";
    pollMessage.textContent = "you've already voted in this poll on this browser.";
    renderPollResults(savedVote);
}

pollForm.addEventListener("submit", event =>
{
    event.preventDefault();

    const selected = document.querySelector('input[name="poll"]:checked');

    if (!selected)
    {
        pollMessage.textContent = "pick one first.";
        return;
    }

    const votes = readStorage(VOTES_KEY, {});

    if (votes[POLL_ID])
    {
        loadSavedVote();
        return;
    }

    votes[POLL_ID] = selected.value;

    if (!writeStorage(VOTES_KEY, votes))
    {
        pollMessage.textContent = "couldn't save your vote in this browser.";
        return;
    }

    document.querySelectorAll('input[name="poll"]').forEach(input =>
    {
        input.disabled = true;
    });

    document.getElementById("vote-button").disabled = true;
    document.getElementById("vote-button").textContent = "already voted";
    document.getElementById("poll-status").textContent = "VOTED";
    pollMessage.textContent = "vote saved on this browser. thanks.";
    renderPollResults(selected.value);
});

// Start everything


renderAnswers();
loadSavedVote();

// One shuffled rotation for all engagement types.
const cards = {
    question: document.querySelector(".question-card"),
    poll: document.querySelector(".poll-card"),
    voice: document.querySelector(".voice-card")
};
const stage = document.querySelector(".rotation-stage");
const progress = document.getElementById("rotation-progress");
let order = [], position = 0, elapsed = 0;
const drafts = new Map();
function shuffleEngagements()
{
    order = questions.map((_, index) => ({type: "question", index}));
    order.push({type: "poll"}, {type: "voice"});
    for (let i = order.length - 1; i > 0; i--)
    {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
    }
    position = 0;
}
function showEngagement()
{
    const item = order[position];
    Object.entries(cards).forEach(([type, card]) => card.hidden = type !== item.type);
    if (item.type === "question")
    {
        questionOrder = questions.map((_, index) => index);
        questionIndex = item.index;
        showQuestion();
        answerInput.value = drafts.get(item.index) || "";
    }
    elapsed = 0;
    progress.style.width = "0%";
}
function moveEngagement(direction)
{
    if (order[position].type === "question") drafts.set(order[position].index, answerInput.value);
    position = (position + direction + order.length) % order.length;
    showEngagement();
}
document.getElementById("previous-engagement").onclick = () => moveEngagement(-1);
document.getElementById("next-engagement").onclick = () => moveEngagement(1);
document.getElementById("skip-question").onclick = () => moveEngagement(1);
const voiceFile = document.getElementById("voice-file");
const voicePreview = document.getElementById("voice-preview");
let audioUrl;
voiceFile.onchange = () => {
    voicePreview.pause();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    voicePreview.hidden = !voiceFile.files.length;
    if (voiceFile.files.length) {
        audioUrl = URL.createObjectURL(voiceFile.files[0]);
        voicePreview.src = audioUrl;
    } else voicePreview.removeAttribute("src");
};
shuffleEngagements();
showEngagement();
setInterval(() => {
    const interacting = stage.contains(document.activeElement) ||
        (order[position].type === "question" && answerInput.value.trim() !== "") ||
        (order[position].type === "voice" && !voicePreview.paused);
    const stopped = interacting || document.hidden;
    if (stopped) return;
    elapsed += 100;
    progress.style.width = `${elapsed / 100}%`;
    if (elapsed >= 10000) moveEngagement(1);
}, 100);
