-- =============================================
-- Author:		<Pat Relos>
-- Create date: <7-6-2023>
-- Description:	<use in datagrid view list employee with loan>
-- =============================================
CREATE PROCEDURE  [dbo].[forpayslipreceivingcopypayrolladjustment]
	-- Add the parameters for the stored procedure here
		@idclient int,
		@iddepartment int,
		@payoutdate date,
		@fromdate date,
		@enddate date,
		@paythrough nvarchar(10)


AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

SELECT        client_branch_position.jobposition, client.companyname, Department.Department_desc, Employee.datehired, client.signprepared, client.signapproved, client.signnoted, Employee.lname, Employee.fname, Employee.mname, 
                         payrolladjustmenttbl.receiveamount, payrolladjustmenttbl.fromdate, payrolladjustmenttbl.payoutdate, payrolladjustmenttbl.enddate, payrolladjustmenttbl.employee_id, payrolladjustmenttbl.idclient, payrolladjustmenttbl.iddepartment, payrolladjustmenttbl.idposition, 
                         Employee.paythrough, Employee.bankaccountno,employee.gcash
FROM            payrolladjustmenttbl INNER JOIN
                         client ON payrolladjustmenttbl.idclient = client.idclient INNER JOIN
                         Employee ON payrolladjustmenttbl.employee_id = Employee.Employee_id INNER JOIN
                         client_branch_position ON payrolladjustmenttbl.idposition = client_branch_position.idbranchposition INNER JOIN
                         Department ON payrolladjustmenttbl.iddepartment = Department.iddepartment
WHERE        
(payrolladjustmenttbl.idclient = @idclient) 
AND (payrolladjustmenttbl.iddepartment = @iddepartment) 
and (Employee.paythrough Like +'%'+ @paythrough +'%') 
and (payoutdate = @payoutdate)
and (fromdate >=@fromdate and enddate <= @enddate)
ORDER BY Employee.lname
END
