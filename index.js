const {ABITupleType, ABIUintType,decodeAddress, ABIArrayDynamicType,ABIByteType, Algodv2,ABIContract, AtomicTransactionComposer, makeBasicAccountTransactionSigner, mnemonicToSecretKey } = require('algosdk');
const mainAbi = require('./main-contract.json')
const requestContract = new ABIContract(mainAbi);
const algosdk = require('algosdk');
const { sha512_256 } = require('js-sha512')

const algodURL = 'https://node.testnet.algoexplorerapi.io'
const token = '';
const port = 443;
const client = new algosdk.Algodv2(token, algodURL, port);

/**
 * encode the source specifications as a ABITupleType
 * position 0 of the ABITupleType is the source ID - see the following URL for list of sources that can be called: https://docs.goracle.io/technical-documentation/integrating-data-feeds/requesting-data/oracle-source-list
 * position 1 of the ABITypleType is the arguments - as specified in the Oracle Sources list
 * position 2 is the maximum age of the data
 */
 const SourceSpecType = new ABITupleType([
  new ABIUintType(32),
  new ABIArrayDynamicType(new ABIArrayDynamicType(new ABIByteType())), // source args...this is usually the JSON path
  new ABIUintType(64), //max age of the data in seconds
]);

/**
 * Encode the request arguments as an ABITupleType
 * position 0 - the request Parameters (see the Oracle Sources list for the parameters needed for your source id) https://docs.goracle.io/technical-documentation/integrating-data-feeds/requesting-data/oracle-source-list
 * position 1 - the aggregation type for numerical data (e.g. average, median, etc.)
 * position 2 - the userData can be any data you want passed back to your application
 */
const RequestArgsType = new ABITupleType([
  new ABIArrayDynamicType(SourceSpecType),
  new ABIUintType(32),
  new ABIArrayDynamicType(new ABIByteType()),
]);

/**
 * Encode the destionation (or the call back,) where the returning data will go
 * position 0 is the app id of the response's destination
 * position 1 is the ABI method signature in the destination app
 */
 const DestinationType = new ABITupleType([
  new ABIUintType(64), //app id of the destination
  new ABIArrayDynamicType(new ABIByteType()), //method signature of the method in the destination app
]);

/**
 * 
 * @param {string} the name of the ABI method 
 * @param {string} contract 
 * @returns 
 */
const getAbiMethod = (
  methodName,
  contract,
) => {

  const m = contract.methods.find((mt) => {
    return mt.name == methodName;
  });

  if (m === undefined) {
    throw Error('UNDEFINED ABI METHOD:::' + methodName);
  }
  return m;
};
/**
 * Helper function to get Algorand box key's name - Learn more about boxes here: https://developer.algorand.org/articles/smart-contract-storage-boxes/
 * @param {*} account 
 * @param {*} key 
 * @returns 
 */
const getKeyedBoxName = (account, key) => {
  return new Uint8Array(
    sha512_256.arrayBuffer([...decodeAddress(account).publicKey, ...key])
  );
};

/**
 * Creates the source array tuble to be used in the request
 * @param {*} sourceID 
 * @param {*} source_args 
 * @param {*} maxAgeSeconds 
 * @returns 
 */
function createSourceArr(
  sourceID,
  source_args,
  maxAgeSeconds,
) {
  return [sourceID, source_args, maxAgeSeconds];
}
/**
 * Creates (via formatting/encoding) the request arguments
 * @param {*} sourceSpecArray 
 * @param {*} aggregationType 
 * @param {*} userData 
 * @returns 
 */
function createRequestArgs(
  sourceSpecArray,
  aggregationType,
  userData
) {
  return RequestArgsType.encode([sourceSpecArray, aggregationType, userData]);
}

 function createDestinationArg(
  destinationAppID,
  destinationMethod
) {
  return DestinationType.encode([destinationAppID, destinationMethod]);
}

 function request(
  requestParams
) {
  const requestGroup = new AtomicTransactionComposer();
  const boxes = [
    {
      appIndex: requestParams.appID,
      name: getKeyedBoxName(requestParams.user.addr, requestParams.key),
    },
  ];

  requestGroup.addMethodCall({
    method: getAbiMethod('request', requestContract),
    methodArgs: [
      requestParams.requestArgs,
      requestParams.destination,
      requestParams.type,
      requestParams.key,
      requestParams.appRefs,
      requestParams.assetRefs,
      requestParams.accountRefs,
      requestParams.boxRefs,
    ],
    boxes: boxes,
    sender: requestParams.user.addr,
    signer: makeBasicAccountTransactionSigner(requestParams.user),
    suggestedParams: requestParams.suggestedParams,
    appID: requestParams.appID,
  });
  return requestGroup;
}

 const makeCall = async () => {

  try {
    const userData = new Uint8Array(Buffer.from('test'));

    const sourceArr = createSourceArr(
      11, // weather
      [
        Buffer.from('005CbGKDn22fNWfXuWQu'),
        Buffer.from('Kenya'),
        Buffer.from('nairobi'),
        Buffer.from('metric'),
        Buffer.from('$.data.temparature'),
        Buffer.from('$.data.timestamp'),
      ],
      60
    );

    const requestArgs = createRequestArgs([sourceArr], 0, userData);
    const destMethod = Buffer.from("test_endpoint");
    const destination = createDestinationArg(162365438, destMethod);
  
    const randomKey = Buffer.from(`${Date.now()}`);
    const params = await client.getTransactionParams().do();
    //TO DO: Add custom algorand address account
    const creator = process.env.account
    //TO DO : Add custom mnemonic
    const creator_mnemonic = process.env.accountMnemonic

    const atc = request({
      appID: 228009344,
      destination: destination,
      requestArgs: requestArgs,
      user: mnemonicToSecretKey(creator_mnemonic),
      suggestedParams: params,
      type: 1,
      key: randomKey,
      appRefs: [228009344],
      assetRefs: [227418519],
      //TO DO: Add custom algorand address account
      accountRefs: [process.env.account],
      boxRefs: [],
    });

    const response = await atc.execute(client, 5)
    console.log('response:', response);

    await new Promise(resolve => setTimeout(resolve, 60000));
  } catch (error) {
    console.error('MAKE REQUEST ERROR:::', error);
  }
}

run();

async function run() {
    makeCall()
}


