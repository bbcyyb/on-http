$repo = "<%=repo%>"
$smb_passwd = "<%=smbPassword%>"
$smb_user = "<%=smbUser%>"
Start-Sleep -s 2
net use w: ${repo} ${smb_passwd} /user:${smb_user}
Start-Sleep -s 2
w:\setup.exe /unattend:x:\Windows\System32\unattend.xml