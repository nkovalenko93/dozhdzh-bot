const {Telegraf} = require('telegraf');
const telegrafGetChatMembers = require('telegraf-getchatmembers');


const bot = new Telegraf('1418336387:AAETgIqX-iPNJ9146K0EqN54v4u91BoZdJY');
bot.use(telegrafGetChatMembers);


let startInitiator;
let started = false;
let addedPlayers = [];
let absentPlayers = [];
let players = [];


const formatTime = (hours, minutes) => `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;


const startGame = (name, members) => {
    started = true;
    startInitiator = name;
    addedPlayers = [];
    absentPlayers = [];
    players = members;
    return `@${name} инициировал сбор.`;
};


const cancelGame = name => {
    startInitiator = null;
    started = false;
    return `Сбор отменён пользователем @${name}.`;
};


const findPlayer = name => players.find(player => (name === player.name));


const findAddedPlayer = name => addedPlayers.find(addedPlayer => (name === addedPlayer.name));


const findAbsentPlayer = name => absentPlayers.find(absentPlayer => (name === absentPlayer.name));


const removeAddedPlayer = name => {
    addedPlayers = addedPlayers.filter(player => (player.name !== name));
};


const removeAbsentPlayer = name => {
    absentPlayers = absentPlayers.filter(player => (player.name !== name));
};


const removeNotAnsweredPlayer = name => {
    players = players.filter(player => (player.name !== name));
};


const addPlayer = (name, time) => {
    let addedPlayer = false;
    let player = findAddedPlayer(name);
    if (player) {
        addedPlayer = true;
    } else {
        player = {name};
    }

    if (time) {
        const [hours, minutes] = time.trim().split(':');
        if (hours && (hours.length < 3) && !isNaN(hours)) {
            player.hours = parseInt(hours, 10);
        }
        if (minutes && (minutes.length < 3) && !isNaN(minutes)) {
            player.minutes = parseInt(minutes, 10);
        }
    }

    if (!addedPlayer) {
        addedPlayers.push(player);
    }
    removeAbsentPlayer(name);
    removeNotAnsweredPlayer(name);

    return `@${name} зарегистрирован на игру${time ? ` и будет доступен в ${formatTime(player.hours, player.minutes)}` : ''}.`;
};


const removePlayer = name => {
    const absentPlayer = findAbsentPlayer(name);
    if (!absentPlayer) {
        absentPlayers.push({name});
    }
    removeAddedPlayer(name);
    removeNotAnsweredPlayer(name);
    return `@${name} сегодня не будет играть.`;
};


const cancelDecision = name => {
    const player = findPlayer(name);
    if (!player) {
        players.push({name});
    }
    removeAddedPlayer(name);
    removeAbsentPlayer(name);
    return `@${name} не знает, будет ли он сегодня играть.`;
};


const handleStartGame = ctx => {
    if (started && startInitiator) {
        return ctx.reply('Сбор уже запущен. Его можно отменить командой "/stop"');
    }

    const message = startGame(
        ctx.update.message.from.username,
        ctx.getChatMembers(ctx.update.message.chat.id).map(({user: {username}}) => ({name: username}))
    );
    return ctx.reply(message);
};


const handleCancelGame = ctx => {
    if (!started) {
        return ctx.reply('Сбор ещё не начат.');
    }

    const message = cancelGame(ctx.update.message.from.username);
    return ctx.reply(message);
};


const handleAddPlayer = ctx => {
    if (!started) {
        handleStartGame(ctx);
    }

    const input = ctx.update.message.text;
    const [, time] = input.split(' ');
    const message = addPlayer(ctx.update.message.from.username, time);
    return ctx.reply(message);
};


const handleRemovePlayer = ctx => {
    if (!started) {
        handleStartGame(ctx);
    }
    const message = removePlayer(ctx.update.message.from.username);
    return ctx.reply(message);
};


const handleCancelDecision = ctx => {
    if (!started) {
        handleStartGame(ctx);
    }
    const message = cancelDecision(ctx.update.message.from.username);
    return ctx.reply(message);
};


const handleStatus = ctx => {
    if (!started) {
        return ctx.reply('Сбор ещё не начат.');
    }

    let added = '';
    if (addedPlayers.length) {
        added = 'Будут играть:\n';
        for (const addedPlayer of addedPlayers) {
            added += ` - @${addedPlayer.name}`;
            if (addedPlayer.hours && addedPlayer.minutes) {
                added += ` в ${formatTime(addedPlayer.hours, addedPlayer.minutes)}`;
            }
            added += '\n';
        }
        if (absentPlayers.length || players.length) {
            added += '\n';
        }
    }

    let absent = '';
    if (absentPlayers.length) {
        absent = 'НЕ будут играть:\n';
        for (const absentPlayer of absentPlayers) {
            absent += ` - @${absentPlayer.name}\n`;
        }
        if (players.length) {
            added += '\n';
        }
    }

    let notAnswered = '';
    if (players.length) {
        notAnswered = 'Не определились:\n';
        for (const player of players) {
            notAnswered += ` - @${player.name}\n`;
        }
    }

    return ctx.reply(added + absent + notAnswered);
};


const getRandomName = names => {
    const index = Math.floor(Math.random() * names.length);
    return names[index];
};


const handleRoulette = ctx => {
    let [, amount, ...names] = ctx.update.message.text.split(' ');
    if (!names || (names.length < 2)) {
        return ctx.reply('Должно быть указано больше одного имени.');
    }

    const excludedNames = [];
    for (let i = 0; i < parseInt(amount, 10); i++) {
        const randomName = getRandomName(names);
        names = names.filter(name => (name !== randomName));
        excludedNames.push(randomName);
    }

    if (excludedNames.length > 1) {
        return ctx.reply(`${excludedNames.join(', ')} идут на DM.`);
    }
    return ctx.reply(`${excludedNames[0]} идёт на DM.`);
};


const handleHelp = ctx => ctx.reply(
    '"/start" - Стартовать сбор\n' +
    '"/stop" - Остановить сбор\n' +
    '"+1" - Отметиться о наличии\n' +
    '"+1 19:00" - Отметиться о наличии с временем, к которому Вы можете играть\n' +
    '"-1" - Отметиться об отсутствии\n' +
    '"/hz" - Отменить своё решение\n' +
    '"/status" - Проверить статус сбора\n' +
    '"/roulette $amount $name1 $name2 $name3 ..." - Крутануть рулетку, выкинув указанное количество игроков'
);


bot.hears('/help', handleHelp);
bot.hears('/start', handleStartGame);
bot.hears('/stop', handleCancelGame);
bot.hears(/\+1(\s)?(\d\d:\d\d)?/g, handleAddPlayer);
bot.hears('-1', handleRemovePlayer);
bot.hears('/hz', handleCancelDecision);
bot.hears('/status', handleStatus);
bot.hears(/\/roulette \w+/g, handleRoulette);
bot.launch();
