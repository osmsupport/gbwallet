import { Connection, PublicKey,LAMPORTS_PER_SOL} from "@solana/web3.js";
import { TokenListProvider } from "@solana/spl-token-registry"; 
import bs58 from "bs58"
import { SERUM_PROGRAM_ID_V3, LIQUIDITY_PROGRAM_ID_V4,  Market, LiquidityPoolKeys, Route, Liquidity, TokenAmount, Token, Percent, TOKEN_PROGRAM_ID, SPL_ACCOUNT_LAYOUT,  TokenAccount,jsonInfo2PoolKeys } from "@raydium-io/raydium-sdk";
import {
  SOL_IMG,
  RAY_IMG,
  RAY_SOL_LP_V4_POOL_KEY,
  RAYDIUM_LIQUIDITY_JSON,
  RAY_TOKEN_MINT
} from './constant';

export async function  getTokenList(){
  const tokenListProvider = new TokenListProvider();
  const tokenListContainer = await tokenListProvider.resolve();
  const list = tokenListContainer
    .filterByClusterSlug('mainnet-beta')
    .getList();
  return list;
}
export async function  getTokenDetails(list,addr) {   
  let token = list.filter(function (value) {
    return value.address == addr
  });
  return token != 'undefined' ? token.length > 0 ? token[0] : [] : [];


}
export async function getTokenAccounts(
  connection,  owner,) {
  const tokenResp = await connection.getTokenAccountsByOwner(
    owner,
    {
      programId: TOKEN_PROGRAM_ID
    },
  );

  const accounts= [];

  for (const { pubkey, account } of tokenResp.value) {
    accounts.push({
      pubkey,
      accountInfo:SPL_ACCOUNT_LAYOUT.decode(account.data)
    });
  }

  return accounts;
}
export async function getTokenAccountsByOwner(connection,owner,list) {
 
  const tokenResp = await connection.getTokenAccountsByOwner(
    owner,
    {
      programId: TOKEN_PROGRAM_ID
    },
  );

  const accounts  = [];
  var pKey = new PublicKey(owner); 
  const result = await connection.getBalance(pKey);  
  accounts.push({
    pKey,
    accountInfo:[],
    tokenDetails:{
      address: 'So11111111111111111111111111111111111111112',
      balance: result / LAMPORTS_PER_SOL,
      logoURI: SOL_IMG,
      name: "Solana",
      symbol: "SOL"
    },
    balance:result / LAMPORTS_PER_SOL || 0
  });

  for (const { pubkey, account } of tokenResp.value) {
    const tokenDetails = await getTokenDetails(list,SPL_ACCOUNT_LAYOUT.decode(account.data).mint.toBase58());
    if (tokenDetails.symbol != undefined && tokenDetails.symbol != 'SCAM') {
      const accBalance = await connection.getTokenAccountBalance(pubkey);
    accounts.push({
      pubkey,
      accountInfo:SPL_ACCOUNT_LAYOUT.decode(account.data),
      tokenDetails:tokenDetails,
      balance:accBalance.value.uiAmount || 0
    });
  }
  }

  return accounts;
}

/**
 * swapInDirection: used to determine the direction of the swap
 * Eg: RAY_SOL_LP_V4_POOL_KEY is using SOL as quote token, RAY as base token
 * If the swapInDirection is true, currencyIn is RAY and currencyOut is SOL
 * vice versa
 */
export async function calcAmountOut(connection, poolKeys, rawAmountIn , swapInDirection) {
  const poolInfo = await Liquidity.fetchInfo({ connection, poolKeys });
  let currencyInMint = poolKeys.baseMint;
  let currencyInDecimals = poolInfo.baseDecimals;
  let currencyOutMint = poolKeys.quoteMint;
  let currencyOutDecimals = poolInfo.quoteDecimals;

  if (!swapInDirection) {
    currencyInMint = poolKeys.quoteMint;
    currencyInDecimals = poolInfo.quoteDecimals;
    currencyOutMint = poolKeys.baseMint;
    currencyOutDecimals = poolInfo.baseDecimals;
  }

  const currencyIn = new Token(currencyInMint, currencyInDecimals);
  const amountIn = new TokenAmount(currencyIn, rawAmountIn, false);
  const currencyOut = new Token(currencyOutMint, currencyOutDecimals);
  const slippage = new Percent(5, 100); // 5% slippage

  const {
      amountOut,
      minAmountOut,
      currentPrice,
      executionPrice,
      priceImpact,
      fee,
  } = Liquidity.computeAmountOut({ poolKeys, poolInfo, amountIn, currencyOut, slippage, });

  return {
      amountIn,
      amountOut,
      minAmountOut,
      currentPrice,
      executionPrice,
      priceImpact,
      fee,
  };
}
export async function fetchAllPoolKeys(poolsKeysJson)
    {  
    const poolsKeys = poolsKeysJson.map((item) => {
      const {
          id,
          baseMint,
          quoteMint,
          lpMint,
          baseDecimals,
          quoteDecimals,
          lpDecimals,
          version,
          programId,
          authority,
          openOrders,
          targetOrders,
          baseVault,
          quoteVault,
          withdrawQueue,
          lpVault,
          marketVersion,
          marketProgramId,
          marketId,
          marketAuthority,
          marketBaseVault,
          marketQuoteVault,
          marketBids,
          marketAsks,
          marketEventQueue,
      } = jsonInfo2PoolKeys(item)
      return {
          id,
          baseMint,
          quoteMint,
          lpMint,
          baseDecimals,
          quoteDecimals,
          lpDecimals,
          version,
          programId,
          authority,
          openOrders,
          targetOrders,
          baseVault,
          quoteVault,
          withdrawQueue,
          lpVault,
          marketVersion,
          marketProgramId,
          marketId,
          marketAuthority,
          marketBaseVault,
          marketQuoteVault,
          marketBids,
          marketAsks,
          marketEventQueue,
      };
    })
    return poolsKeys
  }
export async function fetchPoolKeys(  connection,  poolId,  version= 4) {

  // const version = 4
  const serumVersion = 3
  const marketVersion = 3

  const programId = LIQUIDITY_PROGRAM_ID_V4
  const serumProgramId = SERUM_PROGRAM_ID_V3

  const account = await connection.getAccountInfo(poolId)
  const { state: LiquidityStateLayout }  = Liquidity.getLayouts(version)

  //@ts-ignore
  const fields = LiquidityStateLayout.decode(account.data);
  const { status, baseMint, quoteMint, lpMint, openOrders, targetOrders, baseVault, quoteVault, marketId } = fields;

  let withdrawQueue, lpVault;
  if (Liquidity.isV4(fields)) {
    withdrawQueue = fields.withdrawQueue;
    lpVault = fields.lpVault;
  } else {
    withdrawQueue = PublicKey.default;
    lpVault = PublicKey.default;
  }
  
  // uninitialized
  // if (status.isZero()) {
  //   return ;
  // }

  const associatedPoolKeys = await Liquidity.getAssociatedPoolKeys({
    version,
    baseMint,
    quoteMint,
    marketId,
  });

  const poolKeys = {
    id: poolId,
    baseMint,
    quoteMint,
    lpMint,
    version,
    programId,

    authority: associatedPoolKeys.authority,
    openOrders,
    targetOrders,
    baseVault,
    quoteVault,
    withdrawQueue,
    lpVault,
    marketVersion: serumVersion,
    marketProgramId: serumProgramId,
    marketId,
    marketAuthority: associatedPoolKeys.marketAuthority,
  };

  const marketInfo = await connection.getAccountInfo( marketId);
  const { state: MARKET_STATE_LAYOUT } = Market.getLayouts(marketVersion);
  //@ts-ignore
  const market = MARKET_STATE_LAYOUT.decode(marketInfo.data);

  const {
    baseVault: marketBaseVault,
    quoteVault: marketQuoteVault,
    bids: marketBids,
    asks: marketAsks,
    eventQueue: marketEventQueue,
  } = market;

  // const poolKeys: LiquidityPoolKeys;
  return {
    ...poolKeys,
    ...{
      marketBaseVault,
      marketQuoteVault,
      marketBids,
      marketAsks,
      marketEventQueue,
    },
  };
}
export async function getRouteRelated( connection,  tokenInMint,  tokenOutMint,liquidityJsons) {
  if (!tokenInMint || !tokenOutMint) return []
  const allPoolKeys = await fetchAllPoolKeys(liquidityJsons);
  const tokenInMintString = tokenInMint.toBase58();
  const tokenOutMintString  = tokenOutMint.toBase58();
  
  const routeMiddleMints = ['EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', 'So11111111111111111111111111111111111111112', 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', 'Ea5SjE2Y6yvCeW5dYTn7PYMuW5ikXkvbGdcmSnXeaLjS', '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj', 'USDH1SM1ojwWUga67PGrgFWUHibbjqMvuMaDkRJTgkX', 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB']
   
  const candidateTokenMints = routeMiddleMints.concat([tokenInMintString, tokenOutMintString])
  const onlyRouteMints = routeMiddleMints.filter((routeMint) => ![tokenInMintString, tokenOutMintString].includes(routeMint))
  const routeRelated = allPoolKeys.filter((info) => {
    const isCandidate = candidateTokenMints.includes(info.baseMint.toBase58()) && candidateTokenMints.includes(info.quoteMint.toBase58())
    const onlyInRoute = onlyRouteMints.includes(info.baseMint.toBase58()) && onlyRouteMints.includes(info.quoteMint.toBase58())    
    return isCandidate && !onlyInRoute
  });
  return routeRelated
}

export async function routeSwap(connection, fromPoolKeys,toPoolKeys, ownerKeypair, tokenAccounts){
  console.log('route swap start')

  const owner = ownerKeypair.publicKey
  const fromPoolInfo = await Liquidity.fetchInfo({connection, poolKeys:fromPoolKeys})
  const toPoolInfo = await Liquidity.fetchInfo({connection, poolKeys:toPoolKeys})
  const amountIn = new TokenAmount(new Token(fromPoolKeys.baseMint, fromPoolInfo.baseDecimals), 1, false)
  const currencyOut = new Token(toPoolKeys.quoteMint,toPoolInfo.quoteDecimals)
  // 5% slippage
  const slippage = new Percent(5, 100)

  const { amountOut, minAmountOut, executionPrice, priceImpact, fee } = Route.computeAmountOut({
    fromPoolKeys,
    toPoolKeys,
    fromPoolInfo,
    toPoolInfo,
    amountIn,
    currencyOut,
    slippage,
  });

  // @ts-ignore
  console.log(`route swap: ${fromPoolKeys.id.toBase58()}, amountIn: ${amountIn.toFixed()}, amountOut: ${amountOut.toFixed()}`)

  const { setupTransaction, swapTransaction } =
    await Route.makeSwapTransaction({
      connection,
      fromPoolKeys,
      toPoolKeys,
      userKeys: {
        tokenAccounts,
        owner,
    },
      amountIn,
      amountOut,
      fixedSide: "in",
    });

    return swapTransaction;

  // if (setupTransaction){
  //   await sendTx(connection, setupTransaction.transaction, [ownerKeypair, ...setupTransaction.signers ])
  // }

  // if (swapTransaction){
  //   await sendTx(connection, swapTransaction.transaction, [ownerKeypair, ...swapTransaction.signers ])
  // }
  console.log('route swap end')
}
export async function sendTx(connection, transaction, signers,provider,owner){
  let txRetry = 0

  console.log('signers len:', signers.length)
  console.log('transaction instructions len:', transaction.instructions.length)

  transaction.instructions.forEach(ins => {
    console.log(ins.programId.toBase58())
    ins.keys.forEach(m => {
      console.log('\t', m.pubkey.toBase58(), m.isSigner, m.isWritable)
    });

    console.log('\t datasize:', ins.data.length)
  });

  var block= await connection.getLatestBlockhash('finalized');
  console.log('getLatestBlockhash',block)

  transaction.recentBlockhash = block.blockhash;

  transaction.feePayer=owner;

  //transaction.sign(...signers); 

  console.log('transaction',transaction);
  const rawTransaction = transaction.serialize();


  console.log('packsize :', rawTransaction.length)

  while(++txRetry <= 3){

    const { signature } = await provider.sendTransaction(transaction);
    const txid = await connection.getSignatureStatus(signature);

    // const txid = await connection.sendRawTransaction(rawTransaction, {
    //   skipPreflight: false,
    //   preflightCommitment: 'confirmed'
    // })

    let url = `${txRetry}, https://solscan.io/tx/${txid}`
    if (connection.rpcEndpoint.includes('dev'))
      url += '?cluster=devnet'
    console.log(url)

    await new Promise(resolve => setTimeout(resolve, 1000 * 6))
    const ret = await connection.getSignatureStatus(txid, {searchTransactionHistory:true})
    try {
      //@ts-ignore
      if (ret.value && ret.value.err == null){
        console.log(txRetry,'success')
        break
      } else {
        console.log(txRetry,'failed', ret)
      }
    } catch(e){
      console.log(txRetry,'failed', ret)
    }
  }
}

