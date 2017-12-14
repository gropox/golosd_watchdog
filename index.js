const TeleBot = require("telebot");

const ga = require("golos-addons");
const global = ga.global;
const golos = ga.golos;
const golosjs = golos.golos;

global.initApp("golosd_watchdog");

const CONFIG = global.CONFIG;

golos.setWebsocket(CONFIG.websocket);

const log = global.getLogger("index");


async function checkStatus() {
    log.debug("check status");
    const props = await golos.getCurrentServerTimeAndBlock();
    const block = await golos.golos.api.getBlockAsync(props.block);
    const btime = Date.parse(block.timestamp+"Z");
    const now = Date.now();
    log.debug("pblock", props.block, "block timestamp", new Date(btime), block.timestamp, "now", new Date(now),
        "btime", btime, "now", now,    
        "diff", Math.abs(now - btime));


    const ok = Math.abs(now - btime) <= (30 * 1000);

    return {
        ok,
        block : props.block
    };
}

async function sendStatus(chatid, status) {
    const message = `Статус : ${status.ok ? "OK" : "Блок старше 30 секунд!"}
Последний блок: ${status.block}`;

    await bot.sendMessage(chatid, message, { parse: "Markdown" });    
}

async function onStatus(data) {
    const chatid = data.from.id;
    log.info("received status from chat id " + chatid);
    status = await checkStatus();
    await sendStatus(chatid, status);
    return status;
}

bot = new TeleBot({
    token: CONFIG.token,
    polling: {
        interval: 1000, // Optional. How often check updates (in ms). 
        timeout: 60,
        limit: 100,  //updates
        retryTimeout: 5000
    },
    usePlugins: ['commandButton']
});

bot.on('/status', onStatus);

bot.connect();

let prevStatus = false;

async function run() {

    while (true) {
        try {
            const status = await checkStatus();
            let send = false;
            if (status.ok) {
                send = !prevStatus;
                prevStatus = true;
            } else {
                send = prevStatus;
                prevStatus = false;
            }
            if (send) {
                for (let chatid of CONFIG.chats) {
                    await sendStatus(chatid, status);
                }
            }
        } catch (e) {
            log.error("Unable to check status", e);
            if (!prevStatus) {
                const message = "Не получилось опросить статус ноды: " + e;
                for (let chatid of CONFIG.chats) {
                    await bot.sendMessage(chatid, message, { parse: "Markdown" });
                }
            }
            prevStatus = true;
        }
        await global.sleep(1 * 60 * 1000);
    }
}


run();