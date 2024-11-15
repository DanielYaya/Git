const TelegramBot = require('node-telegram-bot-api');
const { 
    INSERT_REFERAL,
    INSERT_USER,
    UPDATE_USERS_REFERAL_COUNT,
    GET_LEADERBOARD,
    GET_COMMUNITY,
    GET_REFERED_BY,
    CHECK_IF_VERIFIED,
    UPDATE_VERIFIED_STATUS,
    GET_REFERRAL,
    GET_MY_REFERAL,
    DBConnection 
 } = require('./mongo_db');

const channelId = process.env.CHANNEL_ID;  
const channelLink = process.env.CHANNEL_LINK; 
const botLink  = process.env.BOT_LINK;
const defaultReferredBy = process.env.DEFAULT_REFERRED_BY; 
const genReferral=(userId)=>`${botLink}?start=${userId}`;
const token = "7661389909:AAGOfGgnZlM9VBTjuOOFsqiR_6zOHifPQCc"; 

const bot = new TelegramBot(token, {
  polling: {
    interval: 300,  // Interval between polling requests (ms)
    autoStart: true,  // Set to false to control when polling starts
    params: {
      timeout: 60  // Long polling timeout (seconds)
    }
  }
});

DBConnection();
const commands = [
  { command: 'start', description: 'Channel Join ለማድረግ ይህን ይጫኑ' },
  { command: 'referral', description: 'Referral Link ለማግኘት ይህን ይጫኑ' },
  { command: 'myreferrals', description: 'የጋበዙትን ሰው ለማወቅ ይህን ይጫኑ' }
];
// Set commands for the botmyReferrals
bot.setMyCommands(commands).then(() => {
  console.log('Commands have been set successfully.');
});
bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id; 
  const username = msg.from.username || (msg.from.first_name + (msg.from.last_name ? ` ${msg.from.last_name}` : ''));

  let referredBy;
  if (match && match[1]) referredBy = match[1]; else referredBy = process.env.DEFAULT_REFERRED_BY;   
  console.log(`Referred by ${referredBy}`);
  
  try {
    let menuOptions; 
    let is_member=await checkMembership(userId);
    let is_verified=await isApproved(userId);
    if(referredBy!="return" && referredBy!=process.env.DEFAULT_REFERRED_BY && is_member!=1 && is_verified==false){ 
      console.log("newuser Invited!");
      await sendInstructionMenu(userId, username,msg="ከታች ያሉትን ምርጫዎች ይጫኑ:");
    }
    await getOrCreateUser(userId,username,referredBy);
    
    if(is_member==1){
       if (is_verified)  await sendVerifiedMenu(userId, username,msg="ከታች ያሉትን ምርጫዎች ይጫኑ:");  
       else await sendVerifyMenu(userId, username,msg="ከታች ያለውን ምርጫ ይጫኑ:"); 
    }
    else if(is_member==-1){
      //console.log("left user come back");
      if (referredBy==process.env.DEFAULT_REFERRED_BY)  await sendInstructionMenu(userId, username,msg="ከታች ያሉትን ምርጫዎች ይጫኑ:");
      else await sendJoinMenu(userId, username,msg="ከታች ያሉትን ምርጫዎች ይጫኑ:");
    }
    else{
      console.log("newuser Invited!");
      await sendInstructionMenu(userId, username,msg="ከታች ያሉትን ምርጫዎች ይጫኑ:");
    }
    
    

   
  } catch (error) {
      console.error('Error checking membership0:', error);
      bot.sendMessage(userId, "የኔትዎርክ ችግር አጋጥሟል! እንደገና ይሞክሩ.");
  }
});
bot.onText(/\/referral/, async (msg) => {
  const userId = msg.from.id;
  const username = msg.from.username || (msg.from.first_name + (msg.from.last_name ? ` ${msg.from.last_name}` : ''));

  try {
      const member = await checkMembership(userId);
      
      if (member==1) await sendReferralLink(userId,username); 
      else sendJoinMenu(userId, username,"በመጀመርያ ቻናሉን ይቀላቀሉ");
      
  } catch (error) {
      console.error('Error checking membership1:', error);
      bot.sendMessage(userId, "የኔትዎርክ ችግር አጋጥሟል! እንደገና ይሞክሩ.");
  }
});
bot.onText(/\/verify/,async (msg) => {
  const userId = msg.from.id;
  const username = msg.from.username || `${msg.from.first_name} ${msg.from.last_name || ''}`;
  let member=await checkMembership(userId);
console.log(member);
  try { 
    if (member==1) {
      // Mark the referral as verified
      const referredBy = await GET_REFERED_BY(userId);
      if(!isApproved(userId)&&referredBy!=null){
      // verified to true from Referrals collection then increment the referall count for referredById
      await UPDATE_VERIFIED_STATUS(userId);
      await UPDATE_USERS_REFERAL_COUNT(referredBy);
      }
      else {
        await sendViewMenu(userId,username,"");
    }
      } 
    else if(member==-1){

      const referredBy = await GET_REFERED_BY(userId);
      if(!isApproved(userId)&&referredBy!=null){
        // verified to true from Referrals collection then increment the referall count for referredById
        await UPDATE_VERIFIED_STATUS(userId);
        //await UPDATE_USERS_REFERAL_COUNT(referredBy);
        }
    }
    else {
      await sendJoinMenu(userId,username,"");
    }
  } catch (error) {
    console.error('Error verifying referral:', error);
    bot.sendMessage(userId, 'የኔትዎርክ ችግር አጋጥሟል! እንደገና ይሞክሩ.');
  }

});
bot.onText(/\/myreferrals/,async (msg) => {
  const userId = msg.from.id;
  const username = msg.from.username || `${msg.from.first_name} ${msg.from.last_name || ''}`;
  const member= await checkMembership(userId);
  if(member==1){
    let count=await GET_MY_REFERAL(userId);
    await bot.sendMessage(userId, `
       በዚህ ሳምንት ${count}  ያህል ሰዎችን ጋብዘዋል፣ የዚህ ሳምንትን አሸናፊዎች ለመቀላቀል ከጋበዟቸው አጠቃላይ ሰዎች መካከል ቢያስ 50 የሚሆኑት የፀሐይ ባንክ የቴሌግራም ቻናልን መቀላቀል ይኖርባቸዋል፡፡ አሸናፊዎች መጪው ሰኞ  ረፋድ 4 ሰዓት ይገለፃሉ፡፡ 
              መልካም እድል!`);
  }
  else 
  sendJoinMenu(userId, username,"በመጀመርያ ቻናሉን ይቀላቀሉ");
});
 
async function checkMembership(userId) {
  try {
    const member = await bot.getChatMember(channelId, userId);
    console.log(channelId);
    if (member.status === 'member' || member.status === 'administrator' || member.status === 'creator' ) return 1;
    else if(member.status ==='left') return -1;
    else return 0;
  } catch (error) {
    console.error('Error checking membership2:', error);
    return 0;
  }
}

async function sendReferralLink(userId, username) {
  menuOptions = {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'ምንያህል ሰው እንደጋበዙ ለማወቅ ይህን ይጫኑ', callback_data: 'myreferrals' }]
      ]
    }
  }; 
  //await bot.sendMessage(userId, msg, menuOptions);
  const referralLink = genReferral(userId);
  await bot.sendMessage(userId, `
    እንኳን  ወደ ፀሐይ ባንክ በሰላም መጡ!
ይህ ያጋሩ ይሸለሙ ነው!
የእርስዎን የመጋበዣ link: ${referralLink} ለወዳጅ ዘመድዎ ያጋሩ ይሸለሙ፡፡
`,menuOptions);
}
async function sendViewMenu(userId, username,msg="Choose an option") {
  const referralLink = genReferral(userId);
  let menuOptions;
  menuOptions = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '👀 View Channel', url:process.env.CHANNEL_LINK }], 
              [{ text: '🔗 Referral Link', callback_data: 'referral' }]
      ]
    }
  }; 
  await bot.sendMessage(userId, `እንኳን ደህና መጡ! ${username} ${msg}:`, menuOptions);
}
async function sendJoinMenu(userId, username,msg="Choose an option") {
  const referralLink = genReferral(userId);
  let menuOptions;
  menuOptions = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '👉 Join Channel ', url:process.env.CHANNEL_LINK }]
      ]
    }
  }; 
  msg = `<b>${username}</b> እንኳን ወደ ፀሐይ ባንክ በሰላም መጡ!\n
  <b>ይህ ያጋሩ ይሸለሙ ነው!</b>\n
  የእርስዎን የመጋበዣ Link ለወዳጅ ዘመድዎ ያጋሩ ይሸለሙ፡፡\n
  <b>የመጋበዣ Link ለማግኘት:</b>\n
  1. Start የሚለውን ይጫኑ\n
  2. Join Channel የሚለውን ይጫኑ\n
  3. Open Bot የሚለውን ይጫኑ!\n
  4. Continue የሚለውን ተጭነው የመጋበዣ Linkዎን ያግኙ\n
  5. በመጨረሻም የእርስዎን የመጋበዣ Link ለወዳጅ ዘመድዎ በማጋራት ተሸላሚ ይሁኑ!\n`;
  //await bot.sendMessage(userId, `እንኳን ደህና መጡ! ${username} ${msg}:`, menuOptions);
  await bot.sendMessage(userId, msg, { parse_mode: "HTML", ...menuOptions });
}
async function sendVerifyMenu(userId, username,msg="Choose an option") {
  const referralLink = genReferral(userId);
  let menuOptions;
  menuOptions = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '✔️ Continue ', callback_data:'verify' }]  
      ]
    }
  }; 
  await bot.sendMessage(userId, `እንኳን ደህና መጡ! ${username} ${msg}:`, menuOptions);
}
async function sendVerifiedMenu(userId, username,msg="Choose an option") {
  const referralLink = genReferral(userId);
  msg=`${username} እባክዎ ከታች ያሉትን ምርጫዎች ይጫኑ:`;
  let menuOptions;
  menuOptions = {
    reply_markup: {
      inline_keyboard: [ 
        [{ text: '🔗 Refferal Link', callback_data: 'referral' }],
        [{ text: '👀 View Channel', url:process.env.CHANNEL_LINK }] 
      ]
    }
  }; 
  await bot.sendMessage(userId,msg, menuOptions);
}
async function sendInstructionMenu(userId, username,msg="Choose an option") {
  msg = `<b>${username}</b> እንኳን ወደ ፀሐይ ባንክ በሰላም መጡ!\n
  <b>ይህ ያጋሩ ይሸለሙ ነው!</b>\n
  የእርስዎን የመጋበዣ Link ለወዳጅ ዘመድዎ ያጋሩ ይሸለሙ፡፡\n
  <b>የመጋበዣ Link ለማግኘት:</b>\n
  1. Start የሚለውን ይጫኑ\n
  2. Join Channel የሚለውን ይጫኑ\n
  3. Open Bot የሚለውን ይጫኑ!\n
  4. Continue የሚለውን ተጭነው የመጋበዣ Linkዎን ያግኙ\n
  5. በመጨረሻም የእርስዎን የመጋበዣ Link ለወዳጅ ዘመድዎ በማጋራት ተሸላሚ ይሁኑ!\n`;
  const referralLink = genReferral(userId);
  let menuOptions;
  menuOptions = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '👉 Join Channel ', url:process.env.CHANNEL_LINK }]
      ]
    }
  }; 
  await bot.sendMessage(userId, msg, { parse_mode: "HTML", ...menuOptions });
}
// Create or retrieve user
async function getOrCreateUser(userId, username,referredBy=process.env.DEFAULT_REFERRED_BY) {
  let user_exist =await GET_REFERRAL(userId);
  const referralLink =genReferral(userId);
  if (user_exist === null){
     console.log('get or Creare User: link=> ',referralLink);
     await INSERT_USER(
         {
             userId:userId,
             username:username,
             referralCount:0,
             referralLink:referralLink
         }  
     );
     await INSERT_REFERAL({
      referredBy: referredBy, 
      newUserId: userId,
      verified: false,
      createdAt: new Date()}
   );
     return referralLink;
  }
  

 return user_exist;
}

async function isApproved(userId) { 
  const res= await CHECK_IF_VERIFIED(userId);
  return res;
}

bot.on('callback_query', async (callbackQuery) => {
  const action = callbackQuery.data; // Get the callback data
  const userId = callbackQuery.from.id;
  const username = callbackQuery.from.username || `${callbackQuery.from.first_name} ${(callbackQuery.from.last_name ? ` ${callbackQuery.from.last_name}` : '')}`;
  if (action === 'start') {
    const isMember = await checkMembership(userId);
    let is_verified=await isApproved(userId);
    //await getOrCreateUser(userId,username,referredBy);
    if (isMember==1) {
      if (is_verified) await sendVerifiedMenu(userId, username,msg="Choose an option");
      else await sendVerifyMenu(userId, username,msg="Choose an option");
    } else if(isMember==-1) {
      if (referredBy==process.env.DEFAULT_REFERRED_BY)  await sendInstructionMenu(userId, username,msg="ከታች ያሉትን ምርጫዎች ይጫኑ:");
      else await sendJoinMenu(userId, username,msg="ከታች ያሉትን ምርጫዎች ይጫኑ:");
    }
    else await sendInstructionMenu(userId, username,msg=""); 
  }
  else if (action === 'myreferrals') {
  const member= await checkMembership(userId);
  if(member==1){

    //here
    let count=await GET_MY_REFERAL(userId);
    await bot.sendMessage(userId, `
       በዚህ ሳምንት ${count}  ያህል ሰዎችን ጋብዘዋል፣ የዚህ ሳምንትን አሸናፊዎች ለመቀላቀል ከጋበዟቸው አጠቃላይ ሰዎች መካከል ቢያስ 50 የሚሆኑት የፀሐይ ባንክ የቴሌግራም ቻናልን መቀላቀል ይኖርባቸዋል፡፡ አሸናፊዎች መጪው ሰኞ  ረፋድ 4 ሰዓት ይገለፃሉ፡፡ 
              መልካም እድል!`);
  }
  else 
  sendJoinMenu(userId, username,"በመጀመርያ ቻናሉን ይቀላቀሉ");
  }
  else if (action === 'referral') {
    const isMember = await checkMembership(userId);
    if (isMember==1) {
      await sendReferralLink(userId, username);
    } else {
      await bot.sendMessage(userId, 'በመጀመርያ ቻናሉን ይቀላቀሉ');
    }

  } 
  else if(action === 'verify'){
  try {

    
    const referredBy = await GET_REFERED_BY(userId);
    let is_verified=await isApproved(userId);
    let member=await checkMembership(userId);
    if (member==1) {
      // Mark the referral as verified
      
      if(!is_verified&&referredBy!=null){
      // verified to true from Referrals collection then increment the referall count for referredById
      await UPDATE_VERIFIED_STATUS(userId);
      await UPDATE_USERS_REFERAL_COUNT(referredBy);
      await sendViewMenu(userId,username,"");
      }
      else {
        //bot.sendMessage(userId, `Your referral has already been verified or no referral was found.`);
        await sendViewMenu(userId,username,"");
      } 
    } 
    else if(member==-1){
      bot.sendMessage(userId, `You left the channel join and coninue.`);
      await sendJoinMenu(userId,username,"");
    }
    else {
      await sendJoinMenu(userId,username,`   እንኳን ወደ ፀሐይ ባንክ በሰላም መጡ!
    ይህ ያጋሩ ይሸለሙ ነው!
    የእርስዎን የመጋበዣ Link ለወዳጅ ዘመድዎ ያጋሩ ይሸለሙ፡፡
    የእርስዎን የመጋበዣ Link ለማግኘት፡
    1.  Start የሚለውን ይጫኑ
    2.  Join Channel የሚለውን ይጫኑ
    3.  Go Back to the Bot የሚለውን ይጫኑ! 
    4.  Continue የሚለውን ተጭነው የመጋበዣ Linkዎን ያግኙ
    5.  በመጨረሻም የእርስዎን የመጋበዣ Link ለወዳጅ ዘመድዎ በማጋራት ተሸላሚ ይሁኑ!
    
    2.  በዚህ ሳምንት smtmRefbot 2 ያህል ሰዎችን ጋብዘዋል፣ የዚህ ሳምንትን አሸናፊዎች ለመቀላቀል ከጋበዟቸው አጠቃላይ ሰዎች መካከል ቢያስ 50 የሚሆኑት የፀሐይ ባንክ የቴሌግራም ቻናልን መቀላቀል ይኖርባቸዋል፡፡ አሸናፊዎች መጪው ሰኞ  ረፋድ 4 ሰዓት ይገለፃሉ፡፡ 
                  መልካም እድል!`);
    }
  } catch (error) {
    console.error('Error verifying referral:', error);
    bot.sendMessage(userId, 'የኔትዎርክ ችግር አጋጥሟል! እንደገና ይሞክሩ.');
  }
}
 
  await bot.answerCallbackQuery(callbackQuery.id);
});
