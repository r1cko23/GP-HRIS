
-- =============================================
-- Author:		Pats Relos
-- Create date: 2023.July.04 @ 04:03
-- Description:	List of payroll summary
-- =============================================
CREATE PROCEDURE [dbo].[usp_comboclient_List] 
	-- Add the parameters for the stored procedure here
		@keytext varchar(50), 
		@idorganization int
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;
	


/* Exclude joining employee table 
SELECT DISTINCT 
                         client.companyname, client_branch.location + ' ' + client_branch.branch AS clientbranch, client.idclient, client_branch.idclientbranch, Department.Department_desc, Department.iddepartment, client_branch.location, 
                         client_branch.branch, client.signprepared, client.signapproved, client.signnoted, client.ytdstart, client.ytdend, client.thirteenmonthyear, client.basisofsssded, client.basisofphilded
FROM            client INNER JOIN
                         client_branch ON client.idclient = client_branch.idclient 
				INNER JOIN
client_branch_position ON client_branch.idclientbranch = client_branch_position.idclientbranch 
				INNER JOIN
                         Department ON client.idclient = Department.idclient
WHERE        (client.companyname LIKE '%' + @keytext + '%') OR
                         (Department.Department_desc LIKE '%' + @keytext + '%') AND (client.tagdelete = 'N')
*/


SELECT DISTINCT 
                         client.companyname, client_branch.location + ' ' + client_branch.branch AS clientbranch, client.idclient, client_branch.idclientbranch, Department.Department_desc, Department.iddepartment, client_branch.location, 
                         client_branch.branch, client.signprepared, client.signapproved, client.signnoted, client.ytdstart, client.ytdend, client.thirteenmonthyear, client.basisofsssded, client.basisofphilded,client.schedstatutory, client.wtaxsched,client.basisofwtaxded
FROM            client_branch INNER JOIN
                         client INNER JOIN
                         Department INNER JOIN
                         client_branch_position INNER JOIN
                         Employee ON client_branch_position.idbranchposition = Employee.Position1 ON Department.iddepartment = Employee.department_code ON client.idclient = Employee.idclient ON 
                         client_branch.idclientbranch = Employee.idclientbranch
WHERE        (client.companyname LIKE '%' + @keytext + '%') AND (client.tagdelete = N'N') AND (client.idorganization = @idorganization) OR
                         (Department.Department_desc LIKE '%' + @keytext + '%') AND (client.tagdelete = 'N') AND (client.idorganization = @idorganization)

END



