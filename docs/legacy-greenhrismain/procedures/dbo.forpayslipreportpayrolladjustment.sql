-- =============================================
-- Author:		<Pat Relos>
-- Create date: <7-6-2023>
-- Description:	<use in datagrid view list employee with loan>
-- =============================================
CREATE PROCEDURE  [dbo].[forpayslipreportpayrolladjustment]

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


SELECT        client.companyname, Department.Department_desc, payrolladjustmenttbl.receiveamount, payrolladjustmenttbl.enddate, payrolladjustmenttbl.fromdate, payrolladjustmenttbl.payoutdate, payrolladjustmenttbl.employee_id, 
                         Employee.lname, Employee.fname, Employee.mname, 
						 client_branch_position.jobposition, payrolladjustmenttbl.idclient, payrolladjustmenttbl.iddepartment
						 ,Employee.gcash
FROM            client_branch_position INNER JOIN
                         payrolladjustmenttbl INNER JOIN
                         Employee ON payrolladjustmenttbl.employee_id = Employee.Employee_id INNER JOIN
                         client ON payrolladjustmenttbl.idclient = client.idclient INNER JOIN
                         Department ON payrolladjustmenttbl.iddepartment = Department.iddepartment ON client_branch_position.idbranchposition = payrolladjustmenttbl.idposition
WHERE					(payrolladjustmenttbl.enddate <= @enddate) 
						AND (payrolladjustmenttbl.fromdate >= @fromdate) 
						AND (payrolladjustmenttbl.payoutdate = @payoutdate) 
						AND (payrolladjustmenttbl.idclient = @idclient) 
						AND (payrolladjustmenttbl.iddepartment = @iddepartment)
						AND (Employee.paythrough= CASE WHEN @paythrough = '' THEN employee.paythrough ELSE @paythrough END) 
END
