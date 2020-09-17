import { CreateOperation, OperationGenerator } from '../index';

import { Multihash } from '@sidetree/common';

import { KeyGenerator } from './KeyGenerator';

let createOperation: any;

const config = require('../../../element/src/test/element-config.json');

export const generateDidFixtures = async () => {
  // note that this resets the counter.
  const keyGenerator = new KeyGenerator();

  let operation: any = {
    mnemonic: keyGenerator.mnemonic,
  };

  const services = OperationGenerator.generateServiceEndpoints([
    'serviceEndpointId123',
  ]);

  const recoveryKeyPair0 = await keyGenerator.getKeyPair();
  const signingKeyPair0 = await keyGenerator.getSidetreeInternalDataModelKeyPair();

  const createOperationBuffer = await OperationGenerator.generateCreateOperationBuffer(
    recoveryKeyPair0.publicKeyJwk,
    signingKeyPair0.sidetreeInternalDataModelPublicKey as any,
    services
  );

  createOperation = await CreateOperation.parse(createOperationBuffer);

  const didMethodName = config.didMethodName;
  const didUniqueSuffix = createOperation.didUniqueSuffix;
  const shortFormDid = `did:${didMethodName}:${didUniqueSuffix}`;

  const encodedSuffixData = createOperation.encodedSuffixData;
  const encodedDelta = createOperation.encodedDelta;
  const longFormDid = `${shortFormDid}?-${didMethodName}-initial-state=${encodedSuffixData}.${encodedDelta}`;

  const didDocService = [
    {
      id: `#${services[0].id}`,
      serviceEndpoint: services[0].endpoint,
      type: services[0].type,
    },
  ];
  const didDocPublicKey = [
    {
      publicKeyJwk: (signingKeyPair0 as any).jwk,
      controller: '',
      id: `#${(signingKeyPair0 as any).id}`,
      type: (signingKeyPair0 as any).type,
    },
  ];
  const resolveBody = {
    '@context': 'https://www.w3.org/ns/did-resolution/v1',
    didDocument: {
      id: shortFormDid,
      '@context': [
        'https://www.w3.org/ns/did/v1',
        {
          '@base': shortFormDid,
        },
      ],
      service: didDocService,
      publicKey: didDocPublicKey,
      authentication: ['#key2'],
    },
    methodMetadata: {
      recoveryCommitment: createOperation.suffixData.recovery_commitment,
      updateCommitment: createOperation.delta.update_commitment,
    },
  };

  const longFormResolveBody: any = { ...resolveBody };
  longFormResolveBody.didDocument['@context'][1]['@base'] = longFormDid;
  longFormResolveBody.didDocument.id = longFormDid;

  // everything associated with a create operation.
  operation = {
    ...operation,
    operation: [
      {
        type: 'create',
        shortFormDid,
        longFormDid,
        keypair: [recoveryKeyPair0, signingKeyPair0],
        request: JSON.parse(createOperationBuffer.toString()),
        response: resolveBody,
        malformedResponse: longFormResolveBody,
      },
    ],
  };

  const signingKeyPair1 = await keyGenerator.getSidetreeInternalDataModelKeyPair(
    'additional-key'
  );

  const updateOperationJson = await OperationGenerator.createUpdateOperationRequestForAddingAKey(
    didUniqueSuffix,
    signingKeyPair0.sidetreeInternalDataModelPublicKey.jwk,
    signingKeyPair0.privateKeyJwk as any,
    signingKeyPair1 as any,
    // not that this update operation commits to a public key which is dislosed.
    // instead this should be a commitment to a public key which is not in the did document
    // OR a public key with a nonce kid.
    Multihash.canonicalizeThenHashThenEncode(
      signingKeyPair1.sidetreeInternalDataModelPublicKey.jwk
    )
  );

  // everything associated with an update operation.
  operation = {
    ...operation,
    operation: [
      ...operation.operation,
      {
        type: 'update',
        additionalKeyPair: {
          publicKeyJwk: signingKeyPair1.sidetreeInternalDataModelPublicKey.jwk,
          privateKeyJwk: signingKeyPair1.privateKeyJwk,
        },
        request: updateOperationJson,
      },
    ],
  };

  const newRecoveryKey = await keyGenerator.getKeyPair();

  const newSigningKey = await keyGenerator.getSidetreeInternalDataModelKeyPair(
    'newSigningKey'
  );

  const additionalKey2 = await keyGenerator.getSidetreeInternalDataModelKeyPair(
    'newKey'
  );

  const services2 = OperationGenerator.generateServiceEndpoints([
    'recoveredServiceEndpoint456',
  ]);

  const recoverOperationJson = await OperationGenerator.generateRecoverOperationRequest(
    didUniqueSuffix,
    recoveryKeyPair0.privateKeyJwk as any,
    newRecoveryKey.publicKeyJwk,
    newSigningKey.sidetreeInternalDataModelPublicKey as any,
    services2,
    [additionalKey2.sidetreeInternalDataModelPublicKey as any]
  );

  // everything associated with a recover operation.
  operation = {
    ...operation,
    operation: [
      ...operation.operation,
      {
        type: 'recover',
        recoveryKeyPair: {
          publicKeyJwk: newRecoveryKey.publicKeyJwk,
          privateKeyJwk: newRecoveryKey.privateKeyJwk,
        },
        signingKeyPair: {
          publicKeyJwk: newSigningKey.sidetreeInternalDataModelPublicKey.jwk,
          privateKeyJwk: newSigningKey.privateKeyJwk,
        },
        additionalKeyPair: {
          publicKeyJwk: additionalKey2.sidetreeInternalDataModelPublicKey.jwk,
          privateKeyJwk: additionalKey2.privateKeyJwk,
        },
        request: recoverOperationJson,
      },
    ],
  };

  const deactivateOperation = await OperationGenerator.createDeactivateOperation(
    createOperation.didUniqueSuffix,
    newRecoveryKey.privateKeyJwk as any
  );

  // everything associated with a deactivate operation.
  operation = {
    ...operation,
    operation: [
      ...operation.operation,
      {
        type: 'deactivate',
        request: deactivateOperation.operationRequest,
      },
    ],
  };

  return operation;
};