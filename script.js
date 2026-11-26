const el = id => document.getElementById(id);
const cards = {text: document.querySelector('.question-card'), poll: document.querySelector('.poll-card'), voice: document.querySelector('.voice-card')};
let order = [], position = 0, elapsed = 0, busy = false, audioUrl;
const drafts = new Map(), completed = new Set(), pendingVoice = new Set();
const current = () => order[position];
function message(id, text) { el(id).textContent = text; }
const responses = {answers:['noted. questionable, but noted.','this might actually be a good idea.'],votes:['democracy was a mistake.','your questionable opinion has been counted.'],voice_submissions:["can't believe you actually did that.","this might end up in the game. sorry in advance."]};
function thanks(table) { const choices=responses[table]; return choices[Math.floor(Math.random()*choices.length)]; }
const rateMessages = {
    votes: {minute: "bro chill. you're voting a little too fast. try again in a minute.", daily: "democracy can wait. you've reached your 24-hour voting limit."},
    answers: {minute: "bro chill. you're answering a little too fast. try again in a minute.", daily: "that's enough yapping for today. try again later."},
    voice_submissions: {minute: "give your voice a break. try again in a minute.", daily: "save some voice for later. you've reached your 24-hour recording limit."}
};
function errorMessage(e, table) {
    if(e.code==='P0001' && e.message==='RATE_LIMIT_MINUTE')return rateMessages[table]?.minute || 'slow down a little. try again in a minute.';
    if(e.code==='P0001' && e.message==='RATE_LIMIT_DAILY')return rateMessages[table]?.daily || "you've reached your 24-hour limit. try again later.";
    if(e.status===429 || e.code==='over_request_rate_limit')return 'too many requests from this connection. try again later.';
    if(e.code==='human_check')return e.message;
    if(e.code==='captcha_failed')return 'verification failed. try again.';
    return e.code==='23505'?"you've already had your say on this one.":(!navigator.onLine||e instanceof TypeError)?'the internet is being difficult. try again.':'something broke. try again in a bit.';
}
async function stats() {
    try { const [r]=await queryResult(backend.rpc('get_community_stats')); const counts=[r.vote_count,r.answer_count,r.voice_count].map(Number); ['votes','answers','voices'].forEach((k,i)=>message('stats-'+k,counts[i].toLocaleString())); message('stats-total',counts.reduce((a,b)=>a+b,0).toLocaleString()+' contributions to this mess so far.'); el('community-stats').hidden=false; } catch(e){console.error(e);}
}
function controls() {
    const done=completed.has(current()?.id);
    ['answer-submit','vote-button','voice-send','voice-record','voice-file','voice-consent','answer-input'].forEach(id=>el(id).disabled=busy||done);
    el('voice-clear').disabled=busy||done;
    if(pendingVoice.has(current()?.id)) { el('voice-record').disabled=true; el('voice-file').disabled=true; el('voice-clear').disabled=true; }
    document.querySelectorAll('input[name="poll"],input[name="sharing"]').forEach(input=>input.disabled=busy||done);
}
function lock(value) {
    busy = value;
    ['previous-engagement','next-engagement','skip-question','answer-submit','vote-button','voice-send','voice-record','voice-clear','voice-file'].forEach(id => el(id).disabled = value); controls();
}
async function feed() {
    const rows = await queryResult(backend.rpc('get_public_answers'));
    const list = el('community-answers'); list.replaceChildren();
    message('answer-total', `${rows.length} recent answers`);
    if (!rows.length) { const p = document.createElement('p'); p.className='empty-answers'; p.textContent='nothing here yet. you could be first.'; list.append(p); }
    for (const row of rows) { const a=document.createElement('article'); a.className='answer-item'; const p=document.createElement('p'), s=document.createElement('span'); p.textContent=row.answer_text; s.textContent=row.question_text; a.append(p,s); list.append(a); }
}
async function results(q) {
    const rows = await queryResult(backend.rpc('get_poll_results',{poll_id:q.id}));
    const total = rows.reduce((n,r)=>n+Number(r.vote_count),0);
    if(current()!==q) return;
    message('vote-total',`${total} votes`); el('results-list').replaceChildren();
    for(const option of q.options) {
        const count=Number(rows.find(r=>r.option_id===option.id)?.vote_count||0), percent=total?Math.round(count/total*100):0;
        const row=document.createElement('div'); row.className='result-row';
        const label=document.createElement('div'); label.className='result-label';
        const name=document.createElement('span'), number=document.createElement('span'); name.textContent=option.option_text; number.textContent=percent+'%'; label.append(name,number);
        const track=document.createElement('div'), fill=document.createElement('div'); track.className='result-track'; fill.className='result-fill'; fill.style.width=percent+'%'; track.append(fill); row.append(label,track); el('results-list').append(row);
    }
    el('poll-results').hidden=false;
}
async function show() {
    const q=current(); elapsed=0; el('rotation-progress').style.width='0%';
    Object.entries(cards).forEach(([type,card])=>card.hidden=type!==q.question_type);
    if(q.question_type==='text') { message('question-text',q.question_text); message('question-subtext',q.subtext); el('answer-input').value=drafts.get(q.id)||''; message('answer-message',completed.has(q.id)?'already sent. thanks.':''); }
    if(q.question_type==='voice') { message('voice-title',q.question_text); message('voice-subtext',q.subtext||'record something weird.'); message('voice-message',completed.has(q.id)?"you've already sent a recording.":''); clearVoice(); el('voice-consent').checked=false; if(!completed.has(q.id)) recoverVoice(q); }
    if(q.question_type==='poll') {
        message('poll-title',q.question_text); message('poll-subtext',q.subtext||''); message('poll-message',completed.has(q.id)?"you've already had your say on this one.":''); message('poll-status',completed.has(q.id)?'ALREADY VOTED':'OPEN'); el('poll-results').hidden=true; el('poll-options').replaceChildren();
        for(const option of q.options) { const label=document.createElement('label'); label.className='poll-option'; const input=document.createElement('input'); input.type='radio'; input.name='poll'; input.value=option.id; const span=document.createElement('span'); span.textContent=option.option_text; label.append(input,span); el('poll-options').append(label); }
        controls(); try { await results(q); } catch(e) { console.error(e); if(current()===q) message('poll-message','could not load results.'); }
    }
    if(current()===q)controls();
}
function move(direction, automatic=false) {
    if(busy||recording||!order.length)return;
    if(current().question_type==='text') drafts.set(current().id,el('answer-input').value);
    el('voice-preview').pause(); clearVoice(); position=(position+direction+order.length)%order.length; if(automatic && order.some(q=>!completed.has(q.id))) { while(completed.has(current().id))position=(position+1)%order.length; } show();
}
el('previous-engagement').onclick=()=>move(-1); el('next-engagement').onclick=()=>move(1); el('skip-question').onclick=()=>move(1);
async function submit(table, values, id) {
    try { lock(true); const user_id=await getPlayer(); await queryResult(backend.from(table).insert({...values,user_id})); completed.add(values.question_id); message(id,thanks(table)); stats(); return true; }
    catch(e) { console.error(e); if(e.code==='23505')completed.add(values.question_id); message(id,errorMessage(e,table)); return false; }
    finally { lock(false); }
}
el('answer-form').onsubmit=async e=>{e.preventDefault(); if(busy||completed.has(current()?.id))return; const q=current(), text=el('answer-input').value.trim(); if(!text)return; if(await submit('answers',{question_id:q.id,answer_text:text,visibility:document.querySelector('input[name="sharing"]:checked').value},'answer-message')) { completed.add(q.id); drafts.delete(q.id); el('answer-input').value=''; }};
el('poll-form').onsubmit=async e=>{e.preventDefault(); if(busy||completed.has(current()?.id))return; const q=current(), selected=document.querySelector('input[name="poll"]:checked'); if(!selected){message('poll-message','pick one first.');return;} if(await submit('votes',{question_id:q.id,option_id:selected.value},'poll-message'))message('poll-status','ALREADY VOTED'); try{await results(q);}catch(e){console.error(e);}};
let voiceFile, recordedDuration, recording = false, recorder, stream, context, frame, stopTimer, started;
function drawWave(analyser) {
    const canvas = el('voice-wave'), ctx = canvas.getContext('2d');
    const samples = analyser ? new Uint8Array(analyser.fftSize) : null;
    if (analyser) analyser.getByteTimeDomainData(samples);
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.strokeStyle = analyser ? '#BE102F' : '#666666'; ctx.lineWidth = 2; ctx.beginPath();
    for(let x=0;x<canvas.width;x++) {
        const y = samples ? samples[Math.floor(x*samples.length/canvas.width)]/255*canvas.height : canvas.height/2;
        if(x===0)ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.stroke();
}
function preview(file) {
    const audio=el('voice-preview'); audio.pause();
    if(audioUrl)URL.revokeObjectURL(audioUrl); audioUrl=null;
    voiceFile=file; audio.hidden=!file; el('voice-clear').hidden=!file;
    if(file){audioUrl=URL.createObjectURL(file);audio.src=audioUrl;}else{audio.removeAttribute('src');audio.load();}
}
function clearVoice() {
    el('voice-file').value=''; recordedDuration=undefined; preview();
    message('voice-timer','00:00 / 00:30'); drawWave();
}
el('voice-clear').onclick=()=>{if(!busy&&!recording)clearVoice();};
el('voice-file').onchange=()=>{recordedDuration=undefined;preview(el('voice-file').files[0]);};
function stopRecording(){if(recorder && recorder.state==='recording')recorder.stop();}
el('voice-record').onclick=async()=>{
    if(recording){stopRecording();return;}
    if(busy||completed.has(current()?.id))return;
    if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){message('voice-message','microphone recording is unavailable. try uploading a file.');return;}
    recording=true; lock(true); el('voice-record').disabled=true; el('voice-file').disabled=true; clearVoice();
    const cleanup=()=>{
        clearTimeout(stopTimer);cancelAnimationFrame(frame);stream?.getTracks().forEach(t=>t.stop());
        if(context)context.close().catch(()=>{});context=null;stream=null;recorder=null;recording=false;
        el('voice-record').textContent='● record again';el('voice-record').disabled=false;el('voice-file').disabled=false;lock(false);drawWave();
    };
    try{
        stream=await navigator.mediaDevices.getUserMedia({audio:true});
        const mime=['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4'].find(t=>MediaRecorder.isTypeSupported(t));
        if(!mime)throw new Error('No supported audio format');
        recorder=new MediaRecorder(stream,{mimeType:mime,audioBitsPerSecond:64000});
        const chunks=[]; let failed=false;
        recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
        recorder.onerror=()=>{failed=true;message('voice-message','recording failed. try again.');stopRecording();};
        recorder.onstop=()=>{
            const duration=Math.min(30,(performance.now()-started)/1000);
            const type=recorder.mimeType.split(';')[0];const blob=new Blob(chunks,{type});
            cleanup();
            if(!failed&&blob.size&&blob.size<=2000000){recordedDuration=duration;preview(blob);message('voice-message','listen back before sending it.');}
            else if(!failed)message('voice-message','recording was empty or too large. try again.');
        };
        let analyser;
        try{context=new AudioContext();analyser=context.createAnalyser();context.createMediaStreamSource(stream).connect(analyser);}catch(e){console.warn(e);}
        recorder.start();started=performance.now();el('voice-record').disabled=false;el('voice-record').textContent='■ stop recording';
        message('voice-message','recording...');
        const tick=()=>{const seconds=Math.min(30,Math.floor((performance.now()-started)/1000));message('voice-timer',`00:${String(seconds).padStart(2,'0')} / 00:30`);drawWave(analyser);frame=requestAnimationFrame(tick);};
        tick();stopTimer=setTimeout(stopRecording,30000);
    }catch(e){console.error(e);cleanup();message('voice-message','could not access the microphone. check permissions or upload a file.');}
};
async function storedVoice(user, q) {
    const rows=await queryResult(backend.storage.from('voice-submissions').list(`${user}/${q.id}`,{search:'recording'}));
    return rows.some(row=>row.name==='recording');
}
async function recoverVoice(q) {
    try {
        const user=await existingPlayer();
        if(!user)return;
        const exists=await storedVoice(user,q);
        if(current()!==q||busy||completed.has(q.id)||voiceFile)return;
        if(exists) {
            pendingVoice.add(q.id);
            message('voice-message','found your unfinished recording. tick the box and send it again.');
        } else pendingVoice.delete(q.id);
        controls();
    } catch(e){console.error(e);}
}
el('voice-send').onclick=async()=>{
    if(busy||completed.has(current()?.id))return;
    const q=current(), file=voiceFile, duration=recordedDuration ?? el('voice-preview').duration;
    if(!pendingVoice.has(q.id)) {
        if(!file||!file.type.startsWith('audio/')){message('voice-message','pick or record some audio first.');return;}
        if(file.size>2000000){message('voice-message',"that's a bit much. keep it under 2 MB.");return;}
        if(!Number.isFinite(duration)||duration>30){message('voice-message','use playable audio under 30 seconds pls.');return;}
    }
    if(!el('voice-consent').checked){message('voice-message','gotta tick that little box first.');return;}
    try {
        lock(true);
        const user_id=await getPlayer(), file_path=`${user_id}/${q.id}/recording`;
        const existing=await queryResult(backend.from('voice_submissions').select('id').eq('question_id',q.id).eq('user_id',user_id));
        if(existing.length){pendingVoice.delete(q.id);completed.add(q.id);clearVoice();message('voice-message',"you've already sent a recording.");return;}
        const exists=await storedVoice(user_id,q);
        if(exists&&!pendingVoice.has(q.id)) {
            pendingVoice.add(q.id);clearVoice();el('voice-consent').checked=false;
            message('voice-message','an older recording is already uploaded. tick the box to send that one instead.');return;
        }
        if(!exists) {
            pendingVoice.delete(q.id);
            if(!file){message('voice-message','that unfinished recording is gone. record another one.');return;}
            await queryResult(backend.storage.from('voice-submissions').upload(file_path,file,{contentType:file.type,upsert:false}));
        }
        pendingVoice.add(q.id);
        await queryResult(backend.from('voice_submissions').insert({question_id:q.id,user_id,file_path,consent_version:'2026-11-26-v1'}));
        pendingVoice.delete(q.id);clearVoice();el('voice-consent').checked=false;completed.add(q.id);message('voice-message',thanks('voice_submissions'));stats();
    } catch(e){
        console.error(e);
        message('voice-message',errorMessage(e,'voice_submissions')+(pendingVoice.has(q.id)?' your recording is saved. send again later.':''));
    } finally{lock(false);}
};
(async()=>{
    try{order=await queryResult(backend.from('questions').select('id,question_text,question_type,subtext').eq('is_active',true)); const options=await queryResult(backend.from('poll_options').select('*').order('display_order')); for(const q of order)q.options=options.filter(o=>o.question_id===q.id); for(let i=order.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]];} if(!order.length){message('community-loading','nothing to answer yet.');return;} try { const user=await existingPlayer(); const history=user ? await Promise.all(['answers','votes','voice_submissions'].map(table=>queryResult(backend.from(table).select('question_id').eq('user_id',user)))) : []; history.flat().forEach(r=>completed.add(r.question_id)); const first=order.findIndex(q=>!completed.has(q.id)); if(first>=0)position=first; } catch(e){console.error(e);} stats(); await feed(); el('community-loading').hidden=true; el('community').hidden=false; document.querySelector('.answers-section').hidden=false; show(); setInterval(()=>{if(busy||recording||voiceFile||document.hidden||document.querySelector('.rotation-stage').contains(document.activeElement)||(current().question_type==='text'&&el('answer-input').value.trim())||!el('voice-preview').paused)return; elapsed+=100;el('rotation-progress').style.width=`${elapsed/100}%`;if(elapsed>=10000)move(1,true);},100);}
    catch(e){console.error(e);message('community-loading','community stuff is offline for now.');}
})();
