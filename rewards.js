/**
 * Right Donor's Rewards System Application
 * Built by: Fernando Martin Garcia Del Angel
 * Built on: September 6th, 2019
 */

'use strict'

const shim = require('fabric-shim')
const util = require('util')

let Chaincode = class {
    /**
     * Chaincode Instantiation Process
     * @param {Object} stub Instantiation Parameters
     * @returns {Boolean} Function Execution Success Flag
     */
    async Init(stub) {
        let ret = stub.getFunctionAndParameters()
        console.info(ret)
        console.info('===== Instantiated Rewards Chaincode Successfully =====')
        console.info('============== Fernando Martin @ 2019 ===============')
        return shim.success()
    }

    /**
     * Chaincode Invocation Function
     * @param {Object} stub Invocation Parameters
     * @returns {Boolean} Function Execution Success Flag
     */
    async Invoke(stub) {
        console.info('Transaction ID:', stub.getTxID())
        console.info(util.format('Args: %j', stub.getArgs()))
        // Get the method and execute it
        let ret = stub.getFunctionAndParameters()
        let method = this[ret.fcn]
        if (!method) {
            throw new Error('Received unknown function named: ' + ret.fcn)
        }
        // If method does exist, try to execute it
        try {
            let payload = await method(stub, ret.params, this)
            return shim.success(payload)
        } catch (err) {
            console.error(err)
            return shim.error(err)
        }
    }

    /**
     * Initialize an user's state in the ledger
     * @param {Object} stub Chaincode code executor
     * @param {Object} args userId
     * @param {Object} thisClass References to this class
     */
    async registerUser(stub, args, thisClass) {
        //Input Sanitation
        if (args.length != 1) {
            throw new Error('Incorrect number of arguments. Expecting 2')
        }

        if (args[0].length <= 0) {
            throw new Error('1st argument must be a non-empty string literal')
        }

        console.info(' --- start registerUser ---')

        let userID = args[0]

        //Check if user has already been registered
        let userState = await stub.getState(userID)
        if (userState.toString()) {
            throw new Error('User: ' + userID + ' already exists.')
        }

        //Create User object
        let account = {}
        account.id = userID
        account.level = "0"
        account.tokens = "0"

        //Store account on the ledger
        await stub.putState(userID, Buffer.from(JSON.stringify(account)))
        let indexName = 'level~id'
        let levelIdIndexKey = await stub.createCompositeKey(indexName, [account.level, account.id])
        // Save index to state. Only the key name is needed, no need to store a duplicate of the blood.
        // Note - Passing a 'nil' value will effectively delete the key from state, therefore, we pass null character as value.
        await stub.putState(levelIdIndexKey, Buffer.from('\u0000'))
        console.info(' --- end registerUser --- ')
    }

    /**
     * Read an User's information
     * @param {Object} stub Chaincode code executor
     * @param {Object} args userId
     * @param {Object} thisClass References to this class
     */
    async readUser(stub,args,thisClass) {
         // Input Sanitation
         if (args.length != 1) {
            throw new Error('Incorrect number of arguments. Expecting 1')
        }
        // Start query
        let ID = args[0]
        if (!ID) {
            throw new Error('user ID must not be empty')
        }
        //Query the ledger
        let userAsBytes = await stub.getState(ID)
        if (!userAsBytes.toString()) {
            let jsonResp = {}
            jsonResp.Error = 'User: '+ID+' does not exist'
            throw new Error(JSON.stringify(jsonResp))
        }
        console.info('[USER RETRIEVED] ~ ' + userAsBytes.toString() + ' ~ [USER RETRIEVED]')
        return userAsBytes
    }

    /**
     * Add tokens to an user's account
     * @param {Object} stub Chaincode code executor
     * @param {Object} args userId and donated amount
     * @param {Object} thisClass References to this class
     */
    async receiveTokens(stub, args, thisClass) {
        //Input Sanitation
        if (args.length != 2) {
            throw new Error('Incorrect number of arguments. Expecting 2')
        }

        if (args[0].length <= 0) {
            throw new Error('1st argument must be a non-empty string literal')
        }
        if (args[1].length <= 0) {
            throw new Error('2nd argument must be a non-empty string literal')
        }

        let userID = args[0]
        let donatedAmount = args[1]

        console.info(' --- start receiveTokens --- ')
        //Query for an user's information
        let accountAsBytes = await stub.getState(userID)
        if(!accountAsBytes || !accountAsBytes.toString()){
            throw new Error('User [' + userID + '] does not exist')
        }
        //Create a JSON for the user
        let userToReward = {}
        try {
            userToReward = JSON.parse(accountAsBytes.toString())
        }catch(error) {
            let jsonResp = {}
            jsonResp.error = 'Failed to decode JSON of: ' + userID
            throw new Error(jsonResp)
        }
        //Change its data
        let rewarded = parseInt(donatedAmount.toString())
        let acquired = parseInt((userToReward.tokens).toString())
        let total = (rewarded + acquired)
        userToReward.tokens = total
        userToReward.level = total/1000 > parseInt(userToReward.level.toString()) ? Math.floor(total/1000).toString() : userToReward.level.toString()

        //Rewrite it to the ledger
        let accountJSONasBytes = Buffer.from(JSON.stringify(userToReward))
        await stub.putState(userID,accountJSONasBytes)
        console.info(' --- end receiveTokens --- ')
    }

    /**
     * Spend Tokens accordingly
     * @param {Object} stub Chaincode code executor
     * @param {Object} args UserId and spending amount
     * @param {Object} thisClass References to this class
     */
    async spendTokens(stub,args,thisClass){
        //Input Sanitation
        if (args.length != 2) {
            throw new Error('Incorrect number of arguments. Expecting 2')
        }

        if (args[0].length <= 0) {
            throw new Error('1st argument must be a non-empty string literal')
        }
        if (args[1].length <= 0) {
            throw new Error('2nd argument must be a non-empty string literal')
        }

        let userID = args[0]
        let spendingAmount = args[1]

        console.info(' --- start spendTokens --- ')
        //Query for an user's information
        let accountAsBytes = await stub.getState(userID)
        if(!accountAsBytes || !accountAsBytes.toString()){
            throw new Error('User [' + userID + '] does not exist')
        }
        //Create a JSON for the user
        let userToReward = {}
        try {
            userToReward = JSON.parse(accountAsBytes.toString())
        }catch(error) {
            let jsonResp = {}
            jsonResp.error = 'Failed to decode JSON of: ' + userID
            throw new Error(jsonResp)
        }
        //Change its data
        let toSpend = parseInt(spendingAmount.toString())
        let acquired = parseInt(userToReward.tokens)
        if (toSpend > acquired) {
            throw new Error('Token amount: '+userToReward.tokens+' is lower than amount to spend: '+spendingAmount)
        }
        let total = (acquired - toSpend).toString()
        userToReward.tokens = total

        //Rewrite it to the ledger
        let accountJSONasBytes = Buffer.from(JSON.stringify(userToReward))
        await stub.putState(userID,accountJSONasBytes)
        console.info(' --- end spendTokens --- ')
    }

    /**
     * Iterates over all historic data from a USER
     * @param {Iterator} iterator Results Iterator
     * @param {Object} isHistory Checks if it's part of history
     * @returns {Object} USER history
     */
    async getAllResults(iterator, isHistory) {
        let allResults = []
        while (true) {
            let res = await iterator.next()
            if (res.value && res.value.value.toString()) {
                let jsonRes = {}
                console.log(res.value.value.toString('utf8'))
                if (isHistory && isHistory === true) {
                    jsonRes.TxId = res.value.tx_id
                    jsonRes.Timestamp = res.value.timestamp
                    jsonRes.IsDelete = res.value.is_delete.toString()
                    try {
                        jsonRes.Value = JSON.parse(res.value.value.toString('utf8'))
                    } catch (err) {
                        console.error(err)
                        jsonRes.Value = res.value.value.toString('utf8')
                    }
                } else {
                    jsonRes.Key = res.value.key
                    try {
                        jsonRes.Record = JSON.parse(res.value.value.toString('utf8'))
                    } catch (err) {
                        console.error(err)
                        jsonRes.Value = res.value.value.toString('utf8')
                    }
                }
                allResults.push(jsonRes)
            }

            if (res.done) {
                console.log('end of data')
                await iterator.close()
                return allResults
            }
        }
    }

    /**
     * Gets the historic data from an user's spending history
     * @param {Object} stub Chaincode code executor
     * @param {Object} args UserId
     * @param {Object} thisClass References to this class
     * @returns {Object} USER
     */
    async getTransactionHistory(stub, args, thisClass) {
        //Input Sanitation
        if (args.length < 1) {
            throw new Error('Incorrect number of arguments. Expecting userId')
        }
        // Get the Bloodbag
        let ID = args[0]
        console.info(' --- start getTransactionHistory ---')
        //Extract the history from stub iterator
        let resultsIterator = await stub.getHistoryForKey(ID)
        let method = thisClass['getAllResults']
        let results = await method(resultsIterator, true)
        return Buffer.from(JSON.stringify(results))
    }
}

shim.start(new Chaincode())