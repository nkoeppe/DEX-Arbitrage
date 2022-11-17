const hre = require("hardhat");
const fs = require("fs");
require("dotenv").config();

let config, arb, owner, inTrade, balances;
const network = hre.network.name;
if (network === 'aurora') config = require('./../config/aurora.json');
if (network === 'fantom') config = require('./../config/fantom.json');

console.log(`Loaded ${config.routes.length} routes`);

const main = async () => {
  await setup();
  // Scale when using own node
  //[0,0,0,0,0,0,0,0,0].forEach(async (v,i) => {
  //  await new Promise(r => setTimeout(r, i*1000));
  //  await lookForDualTrade();
  //});
  while (true) {
    await lookForDualTrade();
  }
}

const searchForRoutes = () => {
  const targetRoute = {};
  targetRoute.router1 = config.routers[Math.floor(Math.random() * config.routers.length)].address;
  targetRoute.router2 = config.routers[Math.floor(Math.random() * config.routers.length)].address;
  targetRoute.token1 = config.baseAssets[Math.floor(Math.random() * config.baseAssets.length)].address;
  targetRoute.token2 = config.tokens[Math.floor(Math.random() * config.tokens.length)].address;
  return targetRoute;
}

let goodCount = 0;
const useGoodRoutes = () => {
  const targetRoute = {};
  const route = config.routes[goodCount];
  goodCount += 1;
  if (goodCount >= config.routes.length) goodCount = 0;
  targetRoute.router1 = route[0];
  targetRoute.router2 = route[1];
  targetRoute.token1 = route[2];
  targetRoute.token2 = route[3];
  return targetRoute;
}

const lookForDualTrade = async () => {
  let targetRoute;
  if (config.routes.length > 0) {
    targetRoute = useGoodRoutes();
  } else {
    targetRoute = searchForRoutes();
  }
  try {
    let tradeSize = balances[targetRoute.token1].balance;
    if (!!Number(tradeSize)) {
      // console.log("looking for trade")
      // tradeSize = ethers.BigNumber.from("10656754554368405000")
      const amtBack = await arb.estimateDualDexTrade(targetRoute.router1, targetRoute.router2, targetRoute.token1, targetRoute.token2, tradeSize);
      const multiplier = ethers.BigNumber.from(ethers.BigNumber.from(config.minBasisPointsPerTrade).add(10000));
      const sizeMultiplied = tradeSize.mul(multiplier);
      const divider = ethers.BigNumber.from(10000);
      const profitTarget = sizeMultiplied.div(divider);
      if (!config.routes.length > 0) {
        fs.appendFile(`./data/${network}RouteLog.txt`, `["${targetRoute.router1}","${targetRoute.router2}","${targetRoute.token1}","${targetRoute.token2}"],` + "\n", function (err) { });
      }
      if (amtBack.gt(profitTarget)) {
          console.log(`> Making dualTrade... for ${amtBack.sub(profitTarget)}`); 
        await dualTrade(targetRoute.router1, targetRoute.router2, targetRoute.token1, targetRoute.token2, tradeSize);
      }
      else {
        //     await lookForDualTrade();
      }
    } else {
      //   await lookForDualTrade();
    }
  } catch (e) {
    console.log(e);
    // await lookForDualTrade();
  }
}

const dualTrade = async (router1, router2, baseToken, token2, amount) => {
  if (inTrade === true) {
    // await lookForDualTrade();
    return false;
  }

  try {
    inTrade = true;
    // console.log(`${router1},${router2},${baseToken},${token2},${amount}`)
    const txstatic = await arb.connect(owner).callStatic.dualDexTrade(router1, router2, baseToken, token2, amount, { gasPrice: 100003, gasLimit: 500000 }); //{ gasPrice: 1000000000003, gasLimit: 500000 }
    const tx = await arb.connect(owner).dualDexTrade(router1, router2, baseToken, token2, amount, { gasPrice: 100003, gasLimit: 500000 }); //{ gasPrice: 1000000000003, gasLimit: 500000 }
    const x = await tx.wait();
    console.log("######TRADE SUCCESSFULL######")

    inTrade = false;
    // await lookForDualTrade();
  } catch (e) {
    console.log(e.error.message)
    console.log(`tradeAmount: ${amount}`)
    inTrade = false;
    // await lookForDualTrade();
  }
}

const setup = async () => {
  [owner] = await ethers.getSigners();
  console.log(`Owner: ${owner.address}`);
  const IArb = await ethers.getContractFactory('Arb');
  arb = await IArb.attach(config.arbContract);
  balances = {};
  for (let i = 0; i < config.baseAssets.length; i++) {
    const asset = config.baseAssets[i];
    const interface = await ethers.getContractFactory('WETH9');
    const assetToken = await interface.attach(asset.address);
    const balance = await assetToken.balanceOf(config.arbContract);
    console.log(asset.sym, balance.toString());
    balances[asset.address] = { sym: asset.sym, balance, startBalance: balance };
  }
  setTimeout(() => {
    setInterval(() => {
      logResults();
    }, 600000);
    // }, 60);
    logResults();
  }, 120000);
  // }, 120);
}

const logResults = async () => {
  console.log(`############# LOGS #############`);
  for (let i = 0; i < config.baseAssets.length; i++) {
    const asset = config.baseAssets[i];
    const interface = await ethers.getContractFactory('WETH9');
    const assetToken = await interface.attach(asset.address);
    balances[asset.address].balance = await assetToken.balanceOf(config.arbContract);
    const diff = balances[asset.address].balance.sub(balances[asset.address].startBalance);
    const basisPoints = diff.mul(10000).div(!!Number(balances[asset.address].startBalance) ? balances[asset.address].startBalance : 1);
    console.log(`#  ${asset.sym}: ${basisPoints.toString()}bps`);
  }
}

process.on('uncaughtException', function (err) {
  console.log('UnCaught Exception 83: ' + err);
  console.error(err.stack);
  fs.appendFile('./critical.txt', err.stack, function () { });
});

process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: ')
  console.log(p)
  console.log(' - reason: ' + reason);
});

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
