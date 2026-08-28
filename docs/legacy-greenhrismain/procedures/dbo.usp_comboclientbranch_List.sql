
-- =============================================
-- Author:		Pats Relos
-- Create date: 2023.July.04 @ 04:03
-- Description:	List of payroll summary
-- =============================================
CREATE PROCEDURE [dbo].[usp_comboclientbranch_List] 
	-- Add the parameters for the stored procedure here
		@keytext varchar(50),
		@keytext2 varchar(50)
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

/*
include joining of table emp
Select distinct client.companyname, client_branch.branch AS clientbranch, client.idclient, client_branch.idclientbranch, Department.Department_desc, Department.iddepartment, client_branch.location, client_branch.branch, client.signprepared, client.signapproved, client.signnoted, client.ytdstart, client.ytdend, client.thirteenmonthyear,client.basisofsssded,client.basisofphilded,client.schedstatutory,client.wtaxsched
                        From client_branch INNER Join 
                        client INNER Join
                        Department INNER Join 
                        client_branch_position INNER Join 
                        employee On client_branch_position.idbranchposition = Employee.Position1 ON Department.iddepartment = Employee.department_code ON client.idclient = Employee.idclient ON  
                       client_branch.idclientbranch = employee.idclientbranch 
                        WHERE(client.CompanyName Like '%' + @keytext + '%') OR (department.Department_desc Like '%' + @keytext + '%') AND (client.tagdelete = 'N')

*/
begin transaction

										   SELECT DISTINCT 
                         client.companyname, client_branch.branch AS clientbranch, client.idclient, client_branch.idclientbranch, client_branch.location, client_branch.branch, client.signprepared, client.signapproved, client.signnoted, client.ytdstart, 
                         client.ytdend, client.thirteenmonthyear, client.basisofsssded, client.basisofphilded, client.schedstatutory, client.wtaxsched, client.clientstatus, client.frequencypayment,templateuse
FROM            client INNER JOIN
                         client_branch ON client.idclient = client_branch.idclient
WHERE        (client.companyname LIKE  '%' + @keytext + '%') 
				AND (client.tagdelete = N'N')
				and (client_branch.tagdelete = N'N')
				AND (client.clientstatus = N'Active' OR client.companyname LIKE '%' + @keytext + '%') 

ORDER BY client.companyname, clientbranch
						commit
END




		
