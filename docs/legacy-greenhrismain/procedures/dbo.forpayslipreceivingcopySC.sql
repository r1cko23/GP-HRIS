-- =============================================
-- Author:		<Pat Relos>
-- Create date: <7-6-2023>
-- Description:	<use in datagrid view list employee with loan>
-- =============================================
CREATE PROCEDURE  [dbo].[forpayslipreceivingcopySC]
	-- Add the parameters for the stored procedure here
		@idclient int,
		@iddepartment int,
		@paythrough nvarchar(10),
		@payoutdate date,
		@fromdate date,
		@enddate date


AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

SELECT        client_branch_position.jobposition, client.companyname, Department.Department_desc, Employee.datehired, client.signprepared, client.signapproved, client.signnoted, Employee.lname, Employee.fname, Employee.mname, 
                         servicecharge.receiveamount, servicecharge.fromdate, servicecharge.payoutdate, servicecharge.enddate, servicecharge.employee_id, servicecharge.idclient, servicecharge.iddepartment, servicecharge.idposition, 
                         Employee.paythrough, Employee.bankaccountno
FROM            servicecharge INNER JOIN
                         client ON servicecharge.idclient = client.idclient INNER JOIN
                         Employee ON servicecharge.employee_id = Employee.Employee_id INNER JOIN
                         client_branch_position ON servicecharge.idposition = client_branch_position.idbranchposition INNER JOIN
                         Department ON servicecharge.iddepartment = Department.iddepartment
WHERE        (servicecharge.idclient = @idclient) 
AND (servicecharge.iddepartment = @iddepartment) 
and (Employee.paythrough Like +'%'+ @paythrough +'%')
AND (servicecharge.payoutdate = @payoutdate)
and (fromdate >=@fromdate and enddate <= @enddate)
ORDER BY Employee.lname
END
