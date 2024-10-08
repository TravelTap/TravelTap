const express = require('express');
const moment = require('moment');
const path = require('path');
const dbms = require('./Mongo/dbms'); // 몽고DB 실행 구문 모듈
const exchange = require('./exchange/exchange'); // 몽고DB 실행 구문 모듈
const exchangequery = require('./exchange/nowexchange');
const exchangeinfo = require('./exchange/exchangeinfo');
const api = require('./api/api');
const cors = require('cors');
const mongoose = require('mongoose');
const { start } = require('repl');
const { runInContext } = require('vm');

const app = express();
app.use(cors());

app.use(express.static(path.join(__dirname, '../Front/build'))); //경로 변환
app.use(express.json());
//서버 시작 구문 시작
const hostname = '127.0.0.1';
const port = 5500;

app.listen(port, hostname, async () => {
  console.log(`서버가 시작되었습니다. http://${hostname}:${port}/`);
});
//서버 시작 구문 끝

dbms.check().catch(console.dir); //몽고 DB 상태확인

app.get('/lastdate', async (req, res) => {
  await dbms.start();
  let lastdate = await dbms.last();
  res.send(lastdate);
  console.log('마지막 환율 일자를 보내주었습니다.');
  await dbms.end();
});

app.post('/verifytoken', async (req, res) => {
  const id = await api.verifytoken(req.headers.authorization);
  let data = JSON.stringify(id.id);
  console.log(data);
  if(id === null){ data = null;}
  console.log('토큰을 검증했습니다.');
  res.send(data);
});

//index 페이지 부분 시작
app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
  console.log('index.html 페이지를 보내주었습니다!');
});
//index 페이지 부분 끝


//firstpage 페이지 부분 시작
app.get('/firstpage.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', '../firstpage.html'));
  console.log('firstpage 페이지를 보내주었습니다!');
});

app.post('/register', async (req, res) => {
  await dbms.start();
  let data = req.body;
  //console.log(data);
  let register = await dbms.register(data.email, data.password, data.username);
  res.send(register);
  await dbms.end();
});
//firstpage 페이지 부분 끝

//firstpage 페이지 부분 시작
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', '../login.html'));
  console.log('firstpage 페이지를 보내주었습니다!');
});

app.post('/login', async (req, res) => {
  await dbms.start();
  let data = req.body;
  let token = await dbms.login(data.email, data.password);
  res.send(token);
  await dbms.end();
});
//firstpage 페이지 부분 끝

//exchange 페이지 부분 시작
app.get('/exchange.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Back/exchange.html'));
  console.log('exchange.html 페이지를 보내주었습니다!');
});

app.post('/execute', async (req, res) => {
  await dbms.start();
  console.log('환율 정보를 가져옵니다.');
  let date = req.body.date;
  let data = await exchange.exchange(date); //환율가져오기
  await exchange.repeatquery(data, date);
  let text = "환율 정보를 가져오는데 성공했습니다."
  res.send(text);
  await dbms.end();
});
//exchange 페이지 부분 끝

//nowexchange 페이지 부분 시작
app.get('/ExchangeRate.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Back/ExchangeRate.html'));
  console.log('ExchangeRate.html 페이지를 보내주었습니다!');
});

app.get('/nowexchange', async (req, res) => {
  await dbms.start();
  console.log('서버에서 환율데이터를 조회합니다.');
  let nowdate = moment().format('YYYYMMDD');
  try{
    let exchangedata = await exchangequery(nowdate);
    let yesterdaydate = exchangedata.pop();
    let yesterdaydata = await exchangequery(yesterdaydate);
    yesterdaydata.pop();
    exchangedata.push(yesterdaydata);
    let info = await exchangeinfo();
    exchangedata.push(info);
    console.log(`${exchangedata.length}개의 값을 송신`);
    res.send(exchangedata);

  } catch(error){console.error(error);}
  await dbms.end();
});
//nowexchange 페이지 부분 끝

//travel 페이지 부분 시작
app.get('/travel.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Back/travel.html'));
  console.log('travel.html 페이지를 보내주었습니다!');
});

// 나라별 환율 조회
app.get('/mytravel', async (req, res) => {
  console.log('서버에서 각 나라별 오늘의 환율을 조회합니다.');
  let nowdate = moment().format('YYYYMMDD');
  try{
await dbms.start();
    let exchangedata = await exchangequery(nowdate);
    exchangedata.pop();
    let exchangeinfos = await exchangeinfo();
    exchangedata.push(exchangeinfos);
    console.log(`${exchangedata.length}개의 값을 송신`);
    res.send(exchangedata);
    await dbms.end();
  } catch(error){console.error(error);}

});

//travel 페이지 부분 끝

// 내 여행지 추가하기
app.post('/addmytravel', async(req, res) => {
  await dbms.start();
  // 로그인한 사용자 id 가져오기
  const id = await api.verifytoken(req.headers.authorization);
  let data = String(id.id);
  const objectId = new mongoose.Types.ObjectId(data);
  const userinfo = await dbms.userfind(objectId);
  // 사용자가 선택한 여행지 가져오기
  let selectedcountryname = req.body.country;

  // 현재 날짜 가져오기 (YYYY-MM-DD 형식)
  const currentDate = new Date().toISOString().split('T')[0];

  // 여행지 추가할 데이터 객체 생성
  const newTravel = {
    country: selectedcountryname,
    dateAdded: currentDate
  };
  let travel = userinfo[0].travel;
  if (travel.some(user => user.country === selectedcountryname)) {
    //이미 등록된 여행지인 경우
    return res.status(400).json({ message: "이미 등록된 여행지입니다." });
    } else
  // 사용자의 여행지 목록에 추가
  try {
    const users = dbms.Schema('usersinfo');
    await users.findByIdAndUpdate(objectId, { $push: { travel: newTravel}});
    console.log("여행지를 성공적으로 추가 하였습니다.");
    return res.status(200).json({ message: "여행지를 추가 하였습니다." });
  } catch(error) {
    console.log("여행지 추가에 오류가 생겼습니다.");
  }
  await dbms.end();
});



app.get('/getAtms/:country', async (req, res) => {
  try {
      const country = req.params.country;
      console.log(`Requested country: ${country}`); // 요청된 국가 출력
      await dbms.start();
      // MongoDB에서 해당 국가 데이터를 대소문자 구분 없이 검색
      let freeatm = await dbms.freeatm();
      let dataFreeAtm = freeatm[0].allAtms;
      console.log(dataFreeAtm);
      // const atmData = await freeatm.findOne({country: country}); 
      

      if (freeatm[0].length != 0) {
          console.log('ATM Data:', freeatm[0]); // ATM 데이터가 존재하는지 확인
          if (freeatm[0].allAtms) {
              console.log('ATM data found:', freeatm[0].allAtms); // ATM 데이터 출력
              res.json(freeatm[0].allAtms); // 'allAtms' 필드의 데이터를 반환
          } else {
              console.log('No allAtms field in ATM data');
              res.status(404).json({ message: '해당 국가에 대한 ATM 정보가 없습니다1.' });
          }
      } else {
          console.log('ATM data not found for country:', country);
          res.status(404).json({ message: '해당 국가에 대한 ATM 정보가 없습니다2.' });
      }
  } catch (error) {
      console.error('ATM 데이터를 가져오는 중 오류 발생:', error);
      res.status(500).json({ error: '서버 오류가 발생했습니다. 나중에 다시 시도해주세요.' });
  }

});

// 내 카드 추가하기
app.post('/addmycard', async(req, res) => {
  await dbms.start();
  const id = await api.verifytoken(req.headers.authorization);
  let data = String(id.id);
  const objectId = new mongoose.Types.ObjectId(data);
  const userinfo = await dbms.userfind(objectId);
  console.log(userinfo[0]);
  // 프론트에서 카드 이름을 받아옴
  let selectedcardname = req.body.data;
console.log(selectedcardname);
  // 사용자가 추가한 카드 이름을 usersinfo의 card 배열에 저장하기
  if (userinfo[0].card.includes(selectedcardname)) {
  //이미 등록된 카드인 경우
  return res.status(400).json({ message: "이미 등록된 카드입니다." });
  } else {
    try{
    const users = dbms.Schema('usersinfo');
    await users.findByIdAndUpdate(objectId, { $push: { card: selectedcardname } });
    console.log('카드추가에 성공하였습니다.');
    return res.status(200).json({ message: "카드추가에 성공하였습니다." });
    } catch(error) {
      console.log("카드 추가에 문제가 생겼습니다" + error);
    }
  }
  await dbms.end();
});

app.post('/editmyprofile', async (req, res) => {
  await dbms.start();
  const id = await api.verifytoken(req.headers.authorization);
  let data = String(id.id);
  const objectId = new mongoose.Types.ObjectId(data);
  const userinfo = await dbms.userfind(objectId);
  console.log(req.body);
    // 사용자의 id를 가져온다 
  // 사용자가 정보를 수정한 정보를 프론트에서 가져온다
  //이메일 중복 확인
  const username = req.body.이름;
  const phonenumber = req.body.전화번호;
  const email = req.body.이메일;
  const address = req.body.주소;


//   if(email && (email !== userinfo.email)) {
//     const isdup = await dbms.emailduplicatetest(email);
//     if(isdup) {
//       return res.status(400).json({ message: "중복된 이메일이 존재합니다." });
//     }
// }
 // 수정한 정보를 받아 저장한다
  try{
    const users = dbms.Schema('usersinfo');
    await users.findByIdAndUpdate(objectId, {
      $set: {
        email: email,
        username: username,
        phonenumber: phonenumber,
        address: address
      }
    });
    res.status(200).json({ message: "프로필 수정에 성공하였습니다." });
} catch(error) {
    console.log("사용자 정보 수정 오류 발생" + error);
  }
  
  //console.log("수정 완료");
  await dbms.end();
});

// userinfo 전부 가져오기
app.get('/mytravels', async (req, res) =>{
  await dbms.start();
  const id = await api.verifytoken(req.headers.authorization);
  let data = String(id.id);
  const objectId = new mongoose.Types.ObjectId(data);
  const userinfo = await dbms.userfind(objectId);
  console.log(userinfo);
  res.send(userinfo);
  await dbms.end();
});

// 사용자가 현재 위치한 국가와
// 사용자가 소유하고 있는 여행 카드를 기반으로
// 수수료가 무료인 atm기 목록 가져오기
app.get('/getAtmByUser/:userId/:country', async (req, res) => {
  try {
      let usersinfo = dbms.Schema('usersinfo');
      const userId = req.params.userId;
      const country = req.params.country;
      console.log(`Requested user ID: ${userId}, country: ${country}`); // 요청된 사용자 ID와 국가 출력

      // 사용자 정보를 가져옴
      await dbms.start();
      const user = await usersinfo.findById(userId);
      if (!user) {
          console.log('사용자를 찾을 수 없습니다.');
          return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
      }

      const cardArray = user.card; // 사용자의 card 배열 가져옴
      console.log(`User card array: ${cardArray}`);

      // 국가에 해당하는 freeatm 데이터를 가져옴
      let freeatm = await dbms.cardfreeatm();
      // const atmData = await freeatm.find({ country: country });
      if (!freeatm) {
          console.log('해당 국가의 ATM 정보를 찾을 수 없습니다.');
          return res.status(404).json({ message: '해당 국가의 ATM 정보를 찾을 수 없습니다.' });
      }

      // Set을 사용해 중복을 제거하며 데이터를 저장 (JSON 문자열화로 중복 제거)
      const mergedAtmData = new Set();

      // card 배열의 값과 일치하는 필드 데이터들을 Set에 추가 (JSON.stringify 사용)
      console.log("카드 atm");
      console.log(freeatm);

      cardArray.forEach(card => {
          if (freeatm[0][card]) {
            freeatm[0][card].forEach(atm => mergedAtmData.add(JSON.stringify(atm))); // JSON 문자열화 후 Set에 추가
          }
      });

      // 문자열화된 데이터를 다시 파싱하여 배열로 변환
      const myCardAtmData = Array.from(mergedAtmData).map(atm => JSON.parse(atm));
      console.log('Unique ATM data:', myCardAtmData);

      res.json(myCardAtmData); // 중복을 제거한 배열 반환
  } catch (error) {
      console.error('ATM 데이터를 가져오는 중 오류 발생:', error);
      res.status(500).json({ error: '서버 오류가 발생했습니다. 나중에 다시 시도해주세요.' });
  }
});
// 내 정보 수정하기
