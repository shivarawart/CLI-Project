import type { Telegraf } from "telegraf";
import { isOwner } from "./auth";
import {WELCOME} from './contant'
import {commandArg} from './test'
export function registerHandler(bot:Telegraf){
    bot.command("start",async(cts)=>{
     if(!isOwner(cts.chat.id))return;

     await cts.reply(WELCOME,{parse_mode:"Markdown"})

    });
    bot.command("ask",async (cts)=>{
        if(!isOwner(cts.chat.id))return;
        const q = commandArg(cts.message.text,"ask");
        if(!q)
            return cts.reply("Usage: `/ask <your question>`",{
        parse_mode:"Markdown",
        });
        await cts.reply('Researching your question.. ');
        // void runask(cts,q).catch(console.error)
    })
}

//create and debug