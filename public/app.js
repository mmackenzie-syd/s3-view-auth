const {
    CognitoUserPool,
    CognitoUserAttribute,
    CognitoUser,
    AuthenticationDetails,
} = AmazonCognitoIdentity;

AWS.config.region = 'ap-southeast-2';

const albumBucketName = 'view-auth-syd';

// User Access
const poolData = {
    UserPoolId : 'xxxx',
    ClientId : 'xxxx'
};
const userPool = new CognitoUserPool(poolData);
let cognitoUser;
let token = null;
let s3;

const handleSubmit = (event) => {
    event.preventDefault();
    const uname = document.getElementById("uname");
    const password = document.getElementById("password");
    signin(uname.value, password.value);
}

const handleReset = (event) => {
    event.preventDefault();
    const password = document.getElementById("newpasswd");
    console.log('reset-1', password.value)
    reset(password.value);
}

const signin = (email, password) => {
    const authenticationData = {
        Username: email,
        Password: password,
    };
    const authenticationDetails = new AuthenticationDetails(
        authenticationData
    );

    const userData = {
        Username: email,
        Pool: userPool,
    };
    cognitoUser = new CognitoUser(userData);
    cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: function(result) {
            document.getElementById("signin").style.display = "none";
            token = result.getIdToken().getJwtToken();
            setCredentials(token);
        },
        newPasswordRequired: function(result, session) {
            const { email } = result;
            document.getElementById("signin").style.display = "none";
            document.getElementById("reset").style.display = "block";
        },
        onFailure: function(err) {
            alert(err.message || JSON.stringify(err));
        },
    });
}

const setCredentials = (token) => {
    // Add the User's Id Token to the Cognito credentials login map.
    AWS.config.credentials = new AWS.CognitoIdentityCredentials({
        IdentityPoolId: 'xxxx',
        Logins: {
            'xxxx': token
        }
    });
    s3 = new AWS.S3({
        apiVersion: '2006-03-01',
        params: {Bucket: albumBucketName}
    });
    listAlbums();
}

const reset = (password) => {
    cognitoUser.completeNewPasswordChallenge(password, [], {
        onSuccess: function(result) {
            token = result.getIdToken().getJwtToken();
            setCredentials(token)
        },
        onFailure: function(err) {
            alert(err.message || JSON.stringify(err));
        }}
    );
}

const signout = () => async(dispatch) => {
    cognitoUser.signOut();
    document.getElementById("signin").style.display = "block";
    token = null;
}

function getHtml(template) {
    return template.join('\n');
}

// List the photo albums that exist in the bucket.
function listAlbums() {
    s3.listObjects({Delimiter: '/'}, function(err, data) {
        if (err) {
            return alert('There was an error listing your albums: ' + err.message);
        } else {
            var albums = data.CommonPrefixes.map(function(commonPrefix) {
                var prefix = commonPrefix.Prefix;
                var albumName = decodeURIComponent(prefix.replace('/', ''));
                return getHtml([
                    '<li>',
                    '<button style="margin:5px;" onclick="viewAlbum(\'' + albumName + '\')">',
                    albumName,
                    '</button>',
                    '</li>'
                ]);
            });
            var message = albums.length ?
                getHtml([
                    '<p>Click on an album name to view it.</p>',
                ]) :
                '<p>You do not have any albums. Please Create album.';
            var htmlTemplate = [
                '<h2>Albums</h2>',
                message,
                '<ul>',
                getHtml(albums),
                '</ul>',
            ]
            document.getElementById('app').innerHTML = getHtml(htmlTemplate);
        }
    });
}

// Show the photos that exist in an album.
function viewAlbum(albumName) {
    var albumPhotosKey = encodeURIComponent(albumName) + '/';
    s3.listObjects({Prefix: albumPhotosKey}, function(err, data) {
        if (err) {
            return alert('There was an error viewing your album: ' + err.message);
        }
        // 'this' references the AWS.Response instance that represents the response
        var href = this.request.httpRequest.endpoint.href;
        var bucketUrl = href + albumBucketName + '/';

        var photos = data.Contents.map(function(photo) {
            var photoKey = photo.Key;
            var photoUrl = bucketUrl + encodeURIComponent(photoKey);
            return getHtml([
                '<span>',
                '<div>',
                '<br/>',
                '<img style="width:128px;height:128px;" src="' + photoUrl + '"/>',
                '</div>',
                '<div>',
                '<span>',
                photoKey.replace(albumPhotosKey, ''),
                '</span>',
                '</div>',
                '</span>',
            ]);
        });
        var message = photos.length ?
            '<p>The following photos are present.</p>' :
            '<p>There are no photos in this album.</p>';
        var htmlTemplate = [
            '<div>',
            '<button onclick="listAlbums()">',
            'Back To Albums',
            '</button>',
            '</div>',
            '<h2>',
            'Album: ' + albumName,
            '</h2>',
            message,
            '<div>',
            getHtml(photos),
            '</div>',
            '<h2>',
            'End of Album: ' + albumName,
            '</h2>',
            '<div>',
            '<button onclick="listAlbums()">',
            'Back To Albums',
            '</button>',
            '</div>',
        ]
        document.getElementById('app').innerHTML = getHtml(htmlTemplate);
        document.getElementsByTagName('img')[0].setAttribute('style', 'display:none;');
    });
}

