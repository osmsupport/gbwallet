import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletNotConnectedError } from '@solana/wallet-adapter-base';
import {
  GlowWalletAdapter,
  PhantomWalletAdapter,
  SlopeWalletAdapter,
  SolflareWalletAdapter,
  TorusWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import {
  WalletModalProvider,
  WalletDisconnectButton,
  WalletMultiButton
} from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl, LAMPORTS_PER_SOL, PublicKey, Keypair, Connection, Signer, SystemProgram, Transaction } from '@solana/web3.js'
import { getTokenAccountsByOwner, calcAmountOut, getTokenList, getRouteRelated, fetchPoolKeys, routeSwap, getTokenAccounts, sendTx } from '../utils';
import {
  SOL_IMG,
  RAY_IMG,
  RAY_SOL_LP_V4_POOL_KEY,
  GB_USDT_LP_V4_POOL_KEY,
  RAYDIUM_LIQUIDITY_JSON,
  RAY_TOKEN_MINT
} from '../utils/constant';
import {
  Liquidity,
  LiquidityPoolKeys,
  jsonInfo2PoolKeys,
  LiquidityPoolJsonInfo,
  Trade, Route,
  TokenAccount, TokenAmount, Token, Percent, Currency
} from "@raydium-io/raydium-sdk";
function Header(props) {
  const network = WalletAdapterNetwork.Devnet;


  // You can also provide a custom RPC endpoint.
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new GlowWalletAdapter(),
      new SlopeWalletAdapter(),
      new SolflareWalletAdapter({ network }),
      new TorusWalletAdapter(),
    ],
    []
  );
  const wallet = useWallet()
  const { publicKey, signTransaction, sendTransaction } = useWallet()
  const { connection } = useConnection();
  const [inGame, setInGame] = useState(true);
  const [inGameFrom, setInGameFrom] = useState('GB');
  const [inGameTo, setInGameTo] = useState('SOL');
  const [fromBalanceIn, setFromBalanceIn] = useState(100000);
  const [inputIn, setInputIn] = useState(1);
  const [outputIn, setOutputIn] = useState(1000);

  const [solBalance, setSolBalance] = useState(0);
  const [fromBalance, setFromBalance] = useState(0);

  const [rayBalance, setRayBalance] = useState(0);
  const [exchangeRate, setExchangeRate] = useState('');

  const [poolKey, setPoolKey] = useState();
  const [tokenAccounts, setTokenAccounts] = useState([]);

  const [alertHeading, setAlertHeading] = useState('');
  const [alertContent, setAlertContent] = useState('');
  const [alertType, setAlertType] = useState('danger');
  const [alertShow, setAlertShow] = useState(false);
  const [publicKeys, setpublicKey] = useState('');
  const [input, setInput] = useState('0');
  const [output, setOutput] = useState('0');
  const [liquidityJsons, setLiquidityJsons] = useState([]);
  const [swapInDirection, setSwapInDirection] = useState(true); // IN: RAY to SOL; OUT: SOL to RAY

  const [from, setFrom] = useState('GB');
  const [to, setTo] = useState('USDT');
  const [baseMint, setBaseMint] = useState('7R4pJpJdzapj2hEfzQR5bp2ApDjqXNRUA5GTngC6xRZX');
  const [quoteMint, setQuoteMint] = useState('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB');

  const [show, setShow] = useState(false);

  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);
  useEffect(async () => {
    setInputIn(0);
    setOutputIn(0);
    const getPoolInfo = async () => {
      const liquidityJsonResp = await fetch(RAYDIUM_LIQUIDITY_JSON); 
      if (!(await liquidityJsonResp).ok) return []
      const liquidityJson = await liquidityJsonResp.json();
      const allPoolKeysJson = [...(liquidityJson?.official ?? []), ...(liquidityJson?.unOfficial ?? [])]
      setLiquidityJsons(allPoolKeysJson);
    }
    getPoolInfo();

  }, [publicKey, connection]);


  useEffect(() => {

    if (inGameFrom.symbol == 'GB') {
      setOutputIn(parseFloat((inputIn * 0.00009).toFixed(5)));
    }
    else {
      setOutputIn(parseFloat((inputIn * 10381).toFixed(5)));
    }

  }, [inputIn])

  useEffect(() => {
    // update estimated output
    if (exchangeRate) {
      const inputNum = parseFloat(input);
      const calculatedOutput = inputNum * parseFloat(exchangeRate);
      const processedOutput = isNaN(calculatedOutput) ? '0' : String(calculatedOutput);
      setOutput(processedOutput);
    }
  }, [input, exchangeRate]);


  const style = {
    _GB_Banner_Top: {
      background: "#000"
    },
    _nav_link: {
      color: "#fff"
    }
  };
  const sendTransactions = async (
    connection,
    wallet,
    transaction,
    signers,
    awaitConfirmation = true,
    commitment = 'singleGossip',
    includesFeePayer = false,
    block,
  ) => {
    if (!wallet.publicKey) throw new WalletNotConnectedError();

    transaction.recentBlockhash = (
      block || (await connection.getRecentBlockhash(commitment))
    ).blockhash;

    if (includesFeePayer) {
      transaction.setSigners(...signers.map(s => s.publicKey));
    } else {
      transaction.setSigners(
        // fee payed by the wallet owner
        wallet.publicKey,
        ...signers.map(s => s.publicKey),
      );
    }

    if (signers.length > 0) {
      transaction.partialSign(...signers);
    }
    if (!includesFeePayer) {
      transaction = await wallet.signTransaction(transaction);
    }

    const rawTransaction = transaction.serialize();


    let options = {
      skipPreflight: true,
      commitment,
    };

    const txid = await connection.sendRawTransaction(rawTransaction, options);
    // console.log(txid)
    let slot = 0;

    if (awaitConfirmation) {
      const confirmation = await awaitTransactionSignatureConfirmation(
        txid,
        15000,
        connection,
        commitment,
      );

      if (!confirmation)
        throw new Error('Timed out awaiting confirmation on transaction');
      slot = confirmation?.slot || 0;

      if (confirmation?.err) {
        const errors = await getErrorForTransaction(connection, txid);

        console.log(errors);
        throw new Error(`Raw transaction ${txid} failed`);
      }
    }

    return { txid, slot };
  };
  const getErrorForTransaction = async (
    connection,
    txid,
  ) => {
    // wait for all confirmation before geting transaction
    await connection.confirmTransaction(txid, 'max');

    const tx = await connection.getParsedConfirmedTransaction(txid);

    const errors = [];
    if (tx?.meta && tx.meta.logMessages) {
      tx.meta.logMessages.forEach(log => {
        const regex = /Error: (.*)/gm;
        let m;
        while ((m = regex.exec(log)) !== null) {
          // This is necessary to avoid infinite loops with zero-width matches
          if (m.index === regex.lastIndex) {
            regex.lastIndex++;
          }

          if (m.length > 1) {
            errors.push(m[1]);
          }
        }
      });
    }

    return errors;
  };
  async function awaitTransactionSignatureConfirmation(
    txid,
    timeout,
    connection,
    commitment = 'recent',
    queryStatus = false,
  ) {
    let done = false;
    let status = {
      slot: 0,
      confirmations: 0,
      err: null,
    };
    let subId = 0;
    status = await new Promise(async (resolve, reject) => {
      setTimeout(() => {
        if (done) {
          return;
        }
        done = true;
        console.log('Rejecting for timeout...');
        reject({ timeout: true });
      }, timeout);
      try {
        subId = connection.onSignature(
          txid,
          (result, context) => {
            done = true;
            status = {
              err: result.err,
              slot: context.slot,
              confirmations: 0,
            };
            if (result.err) {
              console.log('Rejected via websocket', result.err);
              reject(status);
            } else {
              console.log('Resolved via websocket', result);
              resolve(status);
            }
          },
          commitment,
        );
      } catch (e) {
        done = true;
        console.error('WS error in setup', txid, e);
      }
      while (!done && queryStatus) {
        // eslint-disable-next-line no-loop-func
        (async () => {
          try {
            const signatureStatuses = await connection.getSignatureStatuses([
              txid,
            ]);
            status = signatureStatuses && signatureStatuses.value[0];
            if (!done) {
              if (!status) {
                console.log('REST null result for', txid, status);
              } else if (status.err) {
                console.log('REST error for', txid, status);
                done = true;
                reject(status.err);
              } else if (!status.confirmations) {
                console.log('REST no confirmations for', txid, status);
              } else {
                console.log('REST confirmation for', txid, status);
                done = true;
                resolve(status);
              }
            }
          } catch (e) {
            if (!done) {
              console.log('REST connection error: txid', txid, e);
            }
          }
        })();
        await sleep(2000);
      }
    });

    //@ts-ignore
    if (connection._signatureSubscriptions[subId])
      connection.removeSignatureListener(subId);
    done = true;
    console.log('Returning status', status);
    return status;
  }
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  const handleSwap = async () => {
    const inputNumber = parseFloat(input);
    if (publicKey) {
      try {
        const owner = publicKey;
        const POOL_ID = "58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2"
        const poolKeys = await fetchPoolKeys(connection, new PublicKey(POOL_ID))
        const tokenAccounts = await getTokenAccounts(connection, owner)

        const poolKeysJson = liquidityJsons.filter((item) => ((item.baseMint === 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB' && item.quoteMint == 'So11111111111111111111111111111111111111112') || (item.quoteMint === 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB' && item.baseMint == 'So11111111111111111111111111111111111111112')))?.[0] || null;
        const poolPk = jsonInfo2PoolKeys(poolKeysJson);

        const GB_USDT = '6uqUv9tgvmAfLectf58NNRuEamAN3nNEfemdLtXhnt6Z'
        const RAY_USDT = poolPk.id.toBase58();

        const fromPoolKeys = await fetchPoolKeys(connection, new PublicKey(GB_USDT));
        const toPoolKeys = await fetchPoolKeys(connection, new PublicKey(RAY_USDT))
        const MINT1 = fromPoolKeys.baseMint;
        const MINT2 = toPoolKeys.baseMint;
        console.log('mintids', MINT1, MINT2);


        const relatedPoolKeys = await getRouteRelated(connection, MINT1, MINT2, liquidityJsons);
        // const transactionRes = await routeSwap(connection, fromPoolKeys, toPoolKeys, owner, tokenAccounts)

        console.log(relatedPoolKeys, 'trade swap start');

        console.log('coins', MINT1.toBase58(), MINT2.toBase58());

        relatedPoolKeys.map((ele) => {
          console.log('Routes', ele.id.toBase58());
        })
        //return false;

        //tradeSwap(connection: Connection, tokenInMint: PublicKey, tokenOutMint: PublicKey, relatedPoolKeys: LiquidityPoolKeys[], ownerKeypair: Keypair, tokenAccounts: TokenAccount[])
        const amountIn = new TokenAmount(new Token(MINT1, 9), 1, false);
        console.log('amountIn', amountIn)
        const currencyOut = new Token(MINT2, 9)
        // 5% slippage
        const slippage = new Percent(5, 100)

        const pools = await Promise.all(relatedPoolKeys.map(async (poolKeys) => {
          const poolInfo = await Liquidity.fetchInfo({ connection, poolKeys });
          return {
            poolKeys,
            poolInfo
          }
        }))

        console.log(
          pools,
          currencyOut,
          amountIn,
          slippage);

        const { amountOut, minAmountOut, executionPrice, currentPrice, priceImpact, routes, routeType, fee } = Trade.getBestAmountOut({
          pools,
          currencyOut,
          amountIn,
          slippage
        })
        console.log(routes);

        routes.map((ele) => {
          console.log('Routes Found', ele.keys.id.toBase58());
        })
        console.log(`trade swap: amountIn: ${amountIn.toFixed()}, amountOut: ${amountOut.toFixed()}, executionPrice: ${executionPrice.toFixed()}, ${routeType}`,)

        const { setupTransaction, tradeTransaction } = await Trade.makeTradeTransaction({
          connection,
          routes,
          routeType,
          userKeys: {
            tokenAccounts,
            owner
          },
          amountIn,
          amountOut,
          fixedSide: 'in',
        });

        // const signedTransactions = 
        //   await asyncMap([setupTransaction, tradeTransaction], (merged) => {
        //     if (!merged) return
        //     console.log('merged',merged);
        //     const { transaction, signers } = merged; 
        //     console.log('signers',signers);
        //     return loadTransaction({ transaction: transaction, signers,connection,owner })
        //   })
        const provider = window.solana;
        var transaction1 = setupTransaction.transaction;
        var blockHash1 = await connection.getRecentBlockhash()
        transaction1.feePayer = wallet.publicKey
        transaction1.recentBlockhash = await blockHash1.blockhash
        var transaction2 = tradeTransaction.transaction;
        var blockHash2 = await connection.getRecentBlockhash()
        transaction2.feePayer = wallet.publicKey
        transaction2.recentBlockhash = await blockHash2.blockhash
        // console.log('signedTransactions',signedTransactions);
        const signedTransactions = await provider.signTransaction(transaction1);
        console.log(signedTransactions);
        const signature = await connection.sendRawTransaction(signedTransactions.serialize());
        //   const signedTransactions = await provider.signAllTransactions([transaction1, transaction2]);
        //var res=signAndSendTransaction(connection, wallet, false, setupTransaction.transaction);
        console.log(signature);

        //             const signature = await sendTransaction(transaction, connection);
        //             console.log(signature);
        // if (setupTransaction){
        //    await sendTx(connection, setupTransaction.transaction, [ownerKeypair, ...setupTransaction.signers ],props.provider,owner)
        // }

        // if (tradeTransaction){
        //   await sendTx(connection, tradeTransaction.transaction, [ownerKeypair, ...tradeTransaction.signers ],props.provider,owner)
        // }
        // if(setupTransaction)
        //   await sendTransactions(connection, wallet, setupTransaction.transaction, [...setupTransaction.signers])
        // if(tradeTransaction)
        //  await sendTransactions(connection, wallet, tradeTransaction.transaction, [...tradeTransaction.signers])
        // const txid = await sendTransaction(tradeTransaction.transaction, connection, { ownerKeypair, skipPreflight: true });
        // console.log(`https://solscan.io/tx/${txid}`);
        console.log('Transaction sent');

        console.log('success');
        console.log(true);
      } catch (err) {
        console.error('tx failed => ', err);
        console.log('Something went wrong');
        if (err?.code && err?.message) {
          console.log(`${err.code}: ${err.message}`)
        } else {
          console.log(JSON.stringify(err));
        }
        console.log('danger');
        console.log(true);
      }
    }
  };
  const images = require.context("./../../assets/images", true);
  return (


    <header className="_GB_Header">
      <nav
        style={style._GB_Header_Nav}
        className="navbar navbar-expand-lg  _GB_Header_Nav"
      >
        <div className="container">
          <Link className="navbar-brand" id="_GB_LogoSection" to="/">
            <img
              src={images("./GameBeef.png")}
              alt="Game Beef"
              className="image-fluid"
            />
          </Link>

          <button
            className="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#_GB_MainMenu"
            aria-controls="_GB_MainMenu"
            aria-expanded="false"
            aria-label="Toggle navigation"
          >
            <span className="navbar-toggler-icon"></span>
          </button>
          <div className="collapse navbar-collapse" id="_GB_MainMenu">
            <ul className="navbar-nav me-auto mb-2 mb-lg-0 d-flex justify-content-end w-100">
              <li className="nav-item">
                <Link
                  style={style._nav_link}
                  className="nav-link active"
                  to="/#"
                >
                  Players
                </Link>
              </li>
              <li className="nav-item">
                <Link
                  style={style._nav_link}
                  className="nav-link active"
                  to="/#"
                >
                  Streamers
                </Link>
              </li>
              <li className="nav-item">
                <Link
                  style={style._nav_link}
                  className="nav-link active"
                  to="/#"
                >
                  Marketplace
                </Link>
              </li>

              <>
                <li className="nav-item">
                  <Link
                    style={style._nav_link}
                    className="nav-link active"
                    to="/login"
                  >
                    Login
                  </Link>
                </li>
                <li className="nav-item">

                  <button
                    type="button"
                    className="gb-red-btn  w-100"
                    onClick={handleSwap}
                  >
                    SWAP
                  </button>
                  <WalletMultiButton />
                </li>
              </>
            </ul>
          </div>
        </div>
      </nav>
    </header>

  );
}

export default Header;
