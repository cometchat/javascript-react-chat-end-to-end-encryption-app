import { EThree } from '@virgilsecurity/e3kit-browser';

const VirgilService = async (deps) => {
  try {
    const { CometChat } = deps;
    const nonce = (Math.random().toString(32) + Math.random().toString(32))
      .split('.')
      .join('');

    let eThreeInstanceForLoggedInUser;
    let identityForLoggedInUser;

    const getVirgilTokenAndIdentity = async () => {
      const { virgilToken, identity } = await CometChat.callExtension(
        'e2ee',
        'GET',
        'v1/virgil-jwt',
        null
      );

      return { virgilToken, identity };
    };

    const init = async () => {
      const { virgilToken, identity } = await getVirgilTokenAndIdentity();
      identityForLoggedInUser = identity;
      // e2e_user_1
      eThreeInstanceForLoggedInUser = await EThree.initialize(
        () => virgilToken,
        {
          groupStorageName: `.g_${identityForLoggedInUser}_${nonce}`,
          storageName: `.l_${identityForLoggedInUser}_${nonce}`,
        }
      );

      try {
        // Register the logged in user on Virgil Cloud.
        // A pair of Private key and Public key is created.
        // Private key is sent back and is handled by the E3Kit.
        await eThreeInstanceForLoggedInUser.register();
        console.log(
          'eThreeInstanceForLoggedInUser',
          eThreeInstanceForLoggedInUser.register
        );

        // Immediately back up the private key to Virgil Cloud.
        // This is VERY IMPORTANT!
        await eThreeInstanceForLoggedInUser.backupPrivateKey(
          identityForLoggedInUser
        );
      } catch (error) {
        // This error is thrown if we try to register and existing user.
        if (error.name === 'IdentityAlreadyExistsError') {
          // In such a scenario, check if the Private key is present locally.
          // Usually, this shouldn't be present as we are doing cleanup on logout.
          const hasLocalPrivateKey =
            await eThreeInstanceForLoggedInUser.hasLocalPrivateKey();

          if (!hasLocalPrivateKey) {
            // If the private key is not present locally,
            // Simply restore it from the backup that was created when the
            // user was registered for the first time with Virgil Cloud.
            await eThreeInstanceForLoggedInUser.restorePrivateKey(
              identityForLoggedInUser
            );
          }
        }
      }
    };

    const getIdentitiesFor = async ({ uids, guids }) => {
      // You can include a caching mechanism where you check if the identities
      // for a certain (G)UIDs are present in your cache
      // if not, get is using the below call to the extension.
      const { userIdentities, groupIdentities } = await CometChat.callExtension(
        'e2ee',
        'POST',
        'v1/get-identities',
        { uids, guids }
      );
      return { userIdentities, groupIdentities };
    };

    const getIdentityForUser = async (uid) => {
      const { userIdentities } = await getIdentitiesFor({ uids: [uid] });
      return userIdentities[0][uid];
    };

    const getIdentityForGroup = async (guid) => {
      try {
        const { groupIdentities } = await getIdentitiesFor({ guids: [guid] });
        return groupIdentities[0][guid];
      } catch (e) {
        // console.log(e, guid);
      }
    };

    const getCardsFor = async (identities) => {
      try {
        const cards = await eThreeInstanceForLoggedInUser.findUsers(identities);
        return cards;
      } catch (error) {
        // console.log(error, 'error');
      }
    };

    const encryptOneOnOneText = async (text, receiver) => {
      try {
        const receiverIdentity = await getIdentityForUser(receiver);
        const cards = await eThreeInstanceForLoggedInUser.findUsers(
          receiverIdentity
        );
        const encryptedText = await eThreeInstanceForLoggedInUser.authEncrypt(
          text,
          cards
        );

        return encryptedText;
      } catch (e) {
        return text;
      }
    };

    const decryptOneOnOneText = async (encryptedText, sender) => {
      try {
        const senderIdentity = await getIdentityForUser(sender);
        const senderCard = await getCardsFor(senderIdentity);
        const decryptedText = await eThreeInstanceForLoggedInUser.authDecrypt(
          encryptedText,
          senderCard
        );
        return decryptedText;
      } catch (e) {
        return encryptedText;
      }
    };

    const getVirgilGroup = async (identity) => {
      try {
        const OWNER_CARD = await getCardsFor('2137f9ef75295ea');
        const virgilGroup =
          (await eThreeInstanceForLoggedInUser.getGroup(identity)) ||
          (await eThreeInstanceForLoggedInUser.loadGroup(identity, OWNER_CARD));

        return virgilGroup;
      } catch (e) {}
    };

    const encryptGroupText = async (text, guid) => {
      try {
        const groupIdentity = await getIdentityForGroup(guid);
        const virgilGroup = await getVirgilGroup(groupIdentity);
        const encryptedText = await virgilGroup.encrypt(text);
        return encryptedText;
      } catch (e) {
        return text;
      }
    };

    const decryptGroupText = async (encryptedText, guid, sender) => {
      try {
        const groupIdentity = await getIdentityForGroup(guid);
        const virgilGroup = await getVirgilGroup(groupIdentity);

        const senderIdentity = await getIdentityForUser(sender);
        const senderCard = await getCardsFor(senderIdentity);

        const decryptedText = await virgilGroup.decrypt(
          encryptedText,
          senderCard
        );

        return decryptedText;
      } catch (e) {
        return encryptedText;
      }
    };

    const encryptText = async ({ text, receiver, receiverType }) => {
      try {
        const encryptedText =
          receiverType === 'user'
            ? await encryptOneOnOneText(text, receiver)
            : await encryptGroupText(text, receiver);
        return encryptedText;
      } catch (e) {
        return text;
      }
    };

    const decryptText = async ({
      encryptedText,
      sender,
      receiver,
      receiverType,
    }) => {
      try {
        const text =
          receiverType === 'user'
            ? await decryptOneOnOneText(encryptedText, sender)
            : await decryptGroupText(encryptedText, receiver, sender);
        return text;
      } catch (e) {
        return encryptedText;
      }
    };

    const logout = async () => {
      await eThreeInstanceForLoggedInUser.cleanup();
      eThreeInstanceForLoggedInUser = null;
      identityForLoggedInUser = null;
      window.CometChatVirgilHelper = null;
    };

    // Service initialization
    await init();

    const CometChatVirgilHelper = {
      encryptText,
      decryptText,
      getIdentitiesFor,
      getIdentityForUser,
      getIdentityForGroup,
      logout,
    };

    window.CometChatVirgilHelper = CometChatVirgilHelper;
  } catch (e) {
    return e;
  }
};

export default VirgilService;
