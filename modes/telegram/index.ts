import {Telegraf, Telegram} from 'telegraf';
import chalk from 'chalk';
import {WELCOME} from './contant'
import { promise } from 'zod/v4';
import { resolve } from 'dns';

export async function runTelegramMode(){
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const ownerid = process.env.TELEGRAM_KEY;
    
    const bot = new Telegraf(token!);


    await bot.telegram.sendMessage(ownerid!,WELCOME, {parse_mode:"Markdown"});
    console.log(chalk.green("sent welcome message to telegram. \n"));
    bot.launch();
    console.log(chalk.green('Telegram bot is running. Press ctrl + c to stop'));

    await new Promise<void>((resolve)=>{
        const stop = ()=>{
            bot.stop("SIGINT");
            resolve();
        };
        process.once("SIGINT",stop);
        process.once("SIGALRM",stop)
    });

}

// debug