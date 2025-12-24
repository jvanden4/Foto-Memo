const CLIENT_ID = '923314753991-mb33b5p8q6rr7l4t28oark2ddf08obuc.apps.googleusercontent.com';
const DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'];
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const DATA_FILENAME = 'foto_memo_data.json';

let tokenClient: any;
let gapiInited = false;
let gisInited = false;

export const initGoogleAuth = (onStatusChange: (isLoggedIn: boolean) => void) => {
  const gapiLoaded = () => {
    (window as any).gapi.load('client', async () => {
      await (window as any).gapi.client.init({
        discoveryDocs: DISCOVERY_DOCS,
      });
      gapiInited = true;
      checkAuth();
    });
  };

  const gisLoaded = () => {
    tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: '', // defined at request time
    });
    gisInited = true;
    checkAuth();
  };

  const checkAuth = () => {
    const token = localStorage.getItem('google_drive_token');
    if (token) {
        (window as any).gapi.client.setToken({ access_token: token });
        onStatusChange(true);
    }
  };

  gapiLoaded();
  gisLoaded();
};

export const signIn = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    tokenClient.callback = async (resp: any) => {
      if (resp.error !== undefined) {
        reject(resp);
        return;
      }
      localStorage.setItem('google_drive_token', resp.access_token);
      resolve();
    };

    if ((window as any).gapi.client.getToken() === null) {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      tokenClient.requestAccessToken({ prompt: '' });
    }
  });
};

export const signOut = () => {
  const token = (window as any).gapi.client.getToken();
  if (token !== null) {
    (window as any).google.accounts.oauth2.revoke(token.access_token, () => {
      (window as any).gapi.client.setToken('');
      localStorage.removeItem('google_drive_token');
    });
  }
};

async function getFileId() {
  const response = await (window as any).gapi.client.drive.files.list({
    q: `name = '${DATA_FILENAME}' and trashed = false`,
    fields: 'files(id)',
    spaces: 'drive',
  });
  return response.result.files.length > 0 ? response.result.files[0].id : null;
}

export const saveToDrive = async (data: any) => {
  const fileId = await getFileId();
  const metadata = {
    name: DATA_FILENAME,
    mimeType: 'application/json',
  };
  const content = JSON.stringify(data);
  const boundary = 'foo_bar_baz';
  const delimiter = "\r\n--" + boundary + "\r\n";
  const close_delim = "\r\n--" + boundary + "--";

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    content +
    close_delim;

  if (fileId) {
    // Update existing
    await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${(window as any).gapi.client.getToken().access_token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    });
  } else {
    // Create new
    await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${(window as any).gapi.client.getToken().access_token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    });
  }
};

export const loadFromDrive = async (): Promise<any | null> => {
  const fileId = await getFileId();
  if (!fileId) return null;

  const response = await (window as any).gapi.client.drive.files.get({
    fileId: fileId,
    alt: 'media',
  });
  return response.result;
};
