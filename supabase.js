const backend = window.supabase.createClient('https://spxfogsrrkfqftfcjmjh.supabase.co', 'sb_publishable_8vj5j2V926RMmo7PMBAX6Q_oTWhGKny');
const turnstileKey = '0x4AAAAAAGTiEWiwaqu8siwt';
let sessionPromise;
async function existingPlayer()
{
    const {data,error} = await backend.auth.getSession();
    if (error) throw error;
    return data.session?.user.id || null;
}
function verifyPlayer()
{
    return new Promise((resolve,reject)=>{
        const panel=document.getElementById('human-check'), target=document.getElementById('human-widget'), cancel=document.getElementById('human-cancel');
        let widget, finished=false, timer;
        function finish(error,token)
        {
            if(finished)return;
            finished=true; clearTimeout(timer);
            if(widget!==undefined)window.turnstile.remove(widget);
            target.replaceChildren(); panel.hidden=true; cancel.onclick=null;
            if(error)reject(Object.assign(new Error(error),{code:'human_check'})); else resolve(token);
        }
        panel.hidden=false; cancel.onclick=()=>finish('verification cancelled. try again whenever.');
        timer=setTimeout(()=>finish('verification took too long. try again.'),120000);
        if(!window.turnstile){finish('verification could not load. refresh and try again.');return;}
        try {
            widget=window.turnstile.render(target,{sitekey:turnstileKey,theme:'dark',size:'flexible',callback:token=>finish(null,token),'error-callback':()=>finish('verification failed. try again.'),'expired-callback':()=>finish('verification expired. try again.'),'timeout-callback':()=>finish('verification timed out. try again.')});
        } catch(e){finish('verification could not start. try again.');}
    });
}
function getPlayer()
{
    if (!sessionPromise) sessionPromise = (async () => {
        const user=await existingPlayer();
        if(user)return user;
        const captchaToken=await verifyPlayer();
        const result=await backend.auth.signInAnonymously({options:{captchaToken}});
        if(result.error)throw result.error;
        return result.data.user.id;
    })().finally(()=>{sessionPromise=null;});
    return sessionPromise;
}
async function queryResult(request)
{
    const {data,error} = await request;
    if (error) throw error;
    return data;
}
